// The dispatch agent: it reads everything the buses report and everything Train Watch reports, and it acts on the
// route and writes down what happened. The real-time part is rules in code, because a reroute can't wait on a model
// call or depend on one. The model (server/ai.ts, mode "dispatch") comes after: it reads this log and writes
// the day report, citing entries by id.
//
// What it does, each tick:
//   1. Looks ahead on every moving bus. If an at-grade crossing within LOOKAHEAD_M is blocked (a live Train Watch
//      reading, or the scenario's train), it re-plans through another public crossing of the same track and takes the
//      new route if the extra driving costs less time than the City's estimate to clear. Otherwise it holds.
//   2. Notices a bus stopped where it has no reason to stop.
//   3. Drafts a parent notice when a bus is running late (a preview only; it sends nothing).
//   4. At the school, compares taps on with taps off, and the roster with taps on.
import type { Dataset } from "../analyze";
import { type Bus, type BusState, type SimEvent, type World, SCHEDULE, etaS, hhmm, isBlocked, replanFrom } from "./model";

export const LOOKAHEAD_M = 1200;
/** When the City gives no estimate, assume a blockage lasts this long (seconds). */
export const DEFAULT_WAIT_S = 10 * 60;
const LATE_S = 120;
const STALL_S = 90;

export type LogKind = "depart" | "reroute" | "hold" | "stop" | "late" | "arrive" | "reconcile" | "roster";
export interface LogEntry { id: string; t: number; bus: string | null; kind: LogKind; text: string; source?: "trainwatch" | "scenario" | "telematics" | "smarttag" }

export interface Agent {
  log: LogEntry[];
  /** One-time keys, so a condition is logged once. */
  done: Set<string>;
  stoppedSince: Map<string, number>;
  reroutes: number;
}

export const newAgent = (): Agent => ({ log: [], done: new Set(), stoppedSince: new Map(), reroutes: 0 });

const mins = (s: number) => Math.max(1, Math.round(s / 60));
const miles = (m: number) => (m / 1609.344).toFixed(1);
const short = (s: string) => s.replace(/,.*$/, "");

/** "9 MIN" → 540 s. */
export function parseEstimate(est: string | null): number | null {
  const m = est?.match(/(\d+)\s*MIN/i);
  return m ? +m[1] * 60 : null;
}

function add(ag: Agent, e: Omit<LogEntry, "id">) {
  ag.log.push({ id: `E${ag.log.length + 1}`, ...e });
}

function lookAhead(ag: Agent, w: World, b: Bus, s: BusState, ds: Dataset) {
  if (s.phase !== "driving" && s.phase !== "holding") return;
  const x = s.route.crossings[s.nextXing];
  if (!x || !x.atGrade) return;
  const ahead = x.alongM - s.alongM;
  if (ahead > LOOKAHEAD_M) return;
  const blk = isBlocked(w, x.xing.id);
  if (!blk) return;
  const key = `blk:${b.id}:${x.xing.id}:${blk.from}`;
  if (ag.done.has(key)) return;
  ag.done.add(key);
  const src = blk.source === "trainwatch" ? "live, the City's Train Watch sensor" : "simulated train in the demo scenario";
  const est = blk.estimate ? ` The estimate is ${blk.estimate.toLowerCase()}.` : "";
  const waitS = parseEstimate(blk.estimate) ?? DEFAULT_WAIT_S;
  // Avoid every crossing blocked right now, not just this one.
  const avoid = new Set(w.blockages.filter((z) => w.t >= z.from && w.t < z.to).map((z) => z.xing));
  const alt = replanFrom(s.route, s.alongM, s.loc, b.to.loc, ds, avoid);
  if (alt) {
    const extraM = alt.route.lengthM - s.route.lengthM;
    const extraS = extraM / SCHEDULE.speed;
    const via = alt.route.crossings[alt.passed];
    if (extraS < waitS && via) {
      s.route = alt.route;
      s.nextXing = alt.passed;
      if (s.phase === "holding") s.phase = "driving";
      ag.reroutes++;
      add(ag, {
        t: w.t, bus: b.id, kind: "reroute", source: blk.source,
        text: `${b.id} ${b.label}: ${x.label} is blocked (${src}).${est} Rerouted to cross at ${via.label}. That adds ${extraM > 0 ? `${miles(extraM)} mi, about ${mins(extraS)} min` : "no distance"}, against a wait of about ${mins(waitS)} min.`,
      });
      return;
    }
  }
  add(ag, {
    t: w.t, bus: b.id, kind: "hold", source: blk.source,
    text: `${b.id} ${b.label}: ${x.label} is blocked (${src}).${est} ${alt ? "The other public crossings of this track add more time than waiting," : "There's no other public crossing of this track within reach,"} so the bus waits. Never under or between a stopped train.`,
  });
}

/** Run the agent over one tick's events. Mutates the world only to change a bus's route. */
export function runAgent(ag: Agent, w: World, events: SimEvent[], ds: Dataset) {
  const bus = new Map(w.buses.map((b) => [b.id, b]));
  for (const e of events) {
    const b = bus.get(e.bus)!;
    const s = w.state.get(e.bus)!;
    if (e.kind === "depart") {
      const manual = s.manualTaps ? `, ${s.manualTaps} entered by the driver (no badge)` : "";
      add(ag, { t: e.t, bus: b.id, kind: "depart", source: "smarttag", text: `${b.id} ${b.label}: left ${short(b.from.name)} at ${hhmm(e.t)} with ${s.tappedOn.size} tapped on${manual}.` });
      const noShow = b.roster.filter((r) => r.tapOn === null);
      if (noShow.length)
        add(ag, { t: e.t, bus: b.id, kind: "roster", source: "smarttag", text: `${b.id}: ${noShow.length} rider${noShow.length > 1 ? "s" : ""} on the roster didn't tap on (${noShow.map((r) => r.tag).join(", ")}). HISD's attendance process follows up; the agent only notes it.` });
    }
    if (e.kind === "holding" && !ag.done.has(`hold:${b.id}:${e.xing}`)) {
      ag.done.add(`hold:${b.id}:${e.xing}`);
      add(ag, { t: e.t, bus: b.id, kind: "stop", source: "telematics", text: `${b.id} ${b.label}: stopped at ${e.label}, train on the crossing.` });
    }
    if (e.kind === "arrive") {
      const late = e.t - s.plannedArrival;
      add(ag, {
        t: e.t, bus: b.id, kind: "arrive", source: "telematics",
        text: `${b.id} ${b.label}: arrived at ${short(b.to.name)} at ${hhmm(e.t)}${late >= 60 ? `, ${mins(late)} min after plan` : ", on plan"}.`,
      });
    }
    if (e.kind === "gps") {
      // A stop with no crossing, campus or train to explain it.
      if (e.speed === 0 && s.phase === "driving") {
        const since = ag.stoppedSince.get(b.id) ?? e.t;
        ag.stoppedSince.set(b.id, since);
        const key = `stall:${b.id}:${since}`;
        if (e.t - since >= STALL_S && !ag.done.has(key)) {
          ag.done.add(key);
          add(ag, { t: e.t, bus: b.id, kind: "stop", source: "telematics", text: `${b.id} ${b.label}: stopped for ${mins(e.t - since)} min so far between stops, ${miles(s.alongM)} mi into the route. No crossing or campus there. Logged for the route record.` });
        }
      } else ag.stoppedSince.delete(b.id);
    }
  }

  for (const b of w.buses) {
    const s = w.state.get(b.id)!;
    lookAhead(ag, w, b, s, ds);
    // Running late: one notice per bus, drafted when it first slips past LATE_S.
    if (s.phase !== "boarding" && s.phase !== "done" && s.arrivedAt === null) {
      const slip = etaS(s, w.t) - s.plannedArrival;
      if (slip >= LATE_S && !ag.done.has(`late:${b.id}`)) {
        ag.done.add(`late:${b.id}`);
        add(ag, { t: w.t, bus: b.id, kind: "late", text: `${b.id} ${b.label}: running about ${mins(slip)} min late. Parent notice drafted, not sent: "The shuttle to ${short(b.to.name)} is running about ${mins(slip)} minutes late today."` });
      }
    }
    // At the school, once the door closes: who tapped on and never tapped off.
    if (s.phase === "done" && !ag.done.has(`rec:${b.id}`)) {
      ag.done.add(`rec:${b.id}`);
      const missing = [...s.tappedOn].filter((t) => !s.tappedOff.has(t));
      add(ag, {
        t: w.t, bus: b.id, kind: "reconcile", source: "smarttag",
        text: missing.length
          ? `${b.id} ${b.label}: ${s.tappedOn.size} on, ${s.tappedOff.size} off. ${missing.join(", ")} tapped on and not off. Driver to walk the bus, and the school to check the tag against arrivals.`
          : `${b.id} ${b.label}: ${s.tappedOn.size} on, ${s.tappedOff.size} off. Every tap on has a tap off.`,
      });
    }
  }
}

/** The log as the model reads it: one line per entry, id first, so the report can cite [E12]. */
export const logText = (ag: Agent) => ag.log.map((e) => `[${e.id}] ${hhmm(e.t)} ${e.kind}${e.source ? ` (${e.source})` : ""}: ${e.text}`).join("\n");
