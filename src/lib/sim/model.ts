// A simulated morning on HISD's closure shuttles: one bus per announced pairing (public/data/shuttles.json), the
// signals a bus's telematics unit reports (GPS, speed, doors, a stop at every at-grade rail crossing), and a
// re-creation of SMARTtag: riders tap a badge on and off, and the driver keys it in by hand when there's no badge.
//
// Everything about the riders is invented: tag ids, counts, grades, who forgets to tap off. Real SMARTtag data is
// HISD's and is a student education record under FERPA; this shows how the data flows and what an agent can do with
// it, not anything about real students. The places are real: the campuses, the tracks, the public rail crossings,
// and (where the City has a sensor) whether a train is blocking one right now.
//
// Pure and deterministic for a given seed, so the tests and the page see the same morning.
import type { Dataset } from "../analyze";
import { type RailXing, crossingsOnTrack, railLabel } from "../crossings";
import type { ShuttleStat } from "../data";
import { hazardsOnRoute } from "../analyze";
import { type LngLat, haversine } from "../geo";
import { canBlock } from "../live";

// ---- Clock --------------------------------------------------------------------------------------------------------

/** Sim time is seconds after midnight, Houston time, on a school day. */
export const hhmm = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
export const at = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

export const SCHEDULE = {
  start: at(6, 55),
  boardOpen: at(7, 0),
  depart: at(7, 12),
  /** Average speed on city streets with stops, m/s (about 17 mph). */
  speed: 7.6,
  /** Seconds stopped at each at-grade crossing: buses carrying passengers stop at every one (49 CFR 392.10). */
  railStopS: 20,
  /** Seconds with the door open at the school while riders tap off. */
  alightS: 150,
  end: at(8, 15),
};

// ---- Routes -------------------------------------------------------------------------------------------------------

export interface RouteCrossing {
  xing: RailXing;
  label: string;
  /** The railroad the bus is crossing (the walk hazard's key). */
  track: string;
  atGrade: boolean;
  /** Metres from the start of the route. */
  alongM: number;
}
export interface Route {
  points: LngLat[];
  /** Cumulative metres at each point. */
  cum: number[];
  lengthM: number;
  crossings: RouteCrossing[];
}

/** How far off the straight line a bus may go to use another crossing of the same track. */
const MAX_XING_M = 2500;

function buildRoute(points: LngLat[], xings: { xing: RailXing; track: string }[]): Route {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  const crossings = xings.map(({ xing, track }) => {
    const i = points.findIndex((p) => p === xing.loc);
    return { xing, track, label: railLabel(xing), atGrade: canBlock(xing), alongM: cum[i] };
  });
  return { points, cum, lengthM: cum[cum.length - 1], crossings };
}

/**
 * Pickup campus → receiving school, crossing each railroad on the way at the nearest public crossing of that track
 * that isn't in `avoid`. The bus drives straight segments between those points: the walking routes are for people on foot, so
 * distances are floors and the map shows the crossings the bus uses, not the streets between them.
 */
export function planRoute(from: LngLat, to: LngLat, ds: Dataset, avoid: Set<string> = new Set()): Route | null {
  const rail = hazardsOnRoute(from, to, ds).filter((h) => h.kind === "rail");
  const via: { xing: RailXing; track: string }[] = [];
  for (const h of rail) {
    const options = crossingsOnTrack(ds, h.key)
      // A bus needs a road: pedestrian crossings and paths are out.
      .filter((x) => !avoid.has(x.id) && !/ped|pathway/i.test(x.purpose) && !/^pedestrian/i.test(x.street))
      .map((x) => ({ x, d: haversine(h.at, x.loc) }))
      .filter((o) => o.d <= MAX_XING_M)
      .sort((a, b) => a.d - b.d);
    if (!options.length) return null;
    via.push({ xing: options[0].x, track: h.key });
  }
  // Keep them in the order the straight line meets them.
  via.sort((a, b) => haversine(from, a.xing.loc) - haversine(from, b.xing.loc));
  return buildRoute([from, ...via.map((v) => v.xing.loc), to], via);
}

/**
 * Re-plan from where the bus is now, avoiding `avoid`. The part already driven is kept, so the bus's distance along
 * the route stays the same; tracks already crossed aren't crossed again. The bus's next crossing index becomes
 * `passed` (returned alongside).
 */
export function replanFrom(route: Route, alongM: number, here: LngLat, to: LngLat, ds: Dataset, avoid: Set<string>): { route: Route; passed: number } | null {
  const ahead = planRoute(here, to, ds, avoid);
  if (!ahead) return null;
  const passed = route.crossings.filter((c) => c.alongM < alongM - 0.5);
  const done = new Set(passed.map((c) => c.track));
  const next = ahead.crossings.filter((c) => !done.has(c.track));
  const nextLocs = new Set(next.map((c) => c.xing.loc));
  const behind = route.points.filter((_, i) => route.cum[i] < alongM - 0.5);
  const aheadPts = ahead.points.slice(1).filter((p, i, arr) => i === arr.length - 1 || nextLocs.has(p));
  const r = buildRoute([...behind, here, ...aheadPts], [...passed, ...next].map((c) => ({ xing: c.xing, track: c.track })));
  return { route: r, passed: passed.length };
}

/** Where on the route a distance falls, and the heading there (degrees, 0 = north). */
export function pointAt(route: Route, m: number): { loc: LngLat; heading: number } {
  const d = Math.max(0, Math.min(m, route.lengthM));
  let i = 1;
  while (i < route.cum.length - 1 && route.cum[i] < d) i++;
  const a = route.points[i - 1], b = route.points[i];
  const seg = route.cum[i] - route.cum[i - 1] || 1;
  const f = (d - route.cum[i - 1]) / seg;
  const loc: LngLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), dy = b[1] - a[1];
  return { loc, heading: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 };
}

// ---- Riders (synthetic) -------------------------------------------------------------------------------------------

/** Small seeded RNG (mulberry32), so a morning replays exactly. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rider {
  /** A made-up badge id. No name, no address, no student number. */
  tag: string;
  grade: string;
  /** Sim time the rider taps on; null = on the roster but doesn't ride today. */
  tapOn: number | null;
  /** Taps on with no badge, so the driver enters it. */
  manual: boolean;
  /** Forgets to tap off at the school. */
  noTapOff: boolean;
}

export interface Bus {
  id: string;
  label: string;
  from: { name: string; loc: LngLat };
  to: { name: string; loc: LngLat };
  route: Route;
  roster: Rider[];
}

const shortName = (s: string) => s.replace(/,.*$/, "").replace(/ (ES|MS|HS|ECC)$/, "");

/**
 * One bus per pickup → school pairing HISD announced. The roster sizes, grades and quirks are invented; the anomalies
 * are placed so every kind shows up once in a morning: a no-show, a manual entry, a missed tap-off.
 */
export function makeBuses(shuttles: ShuttleStat[], ds: Dataset, seed = 20260928): Bus[] {
  const r = rng(seed);
  const buses: Bus[] = [];
  for (const s of shuttles) {
    if (s.sameSite) continue;
    for (const to of s.to) {
      const route = planRoute(s.from.loc, to.loc, ds);
      if (!route) continue;
      const secondary = /MS|HS/.test(s.from.name);
      const n = 6 + Math.floor(r() * 17);
      const roster: Rider[] = Array.from({ length: n }, () => ({
        tag: `T-${Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, "0")}`,
        grade: secondary ? String(6 + Math.floor(r() * 3)) : ["K", "1", "2", "3", "4", "5"][Math.floor(r() * 6)],
        tapOn: SCHEDULE.boardOpen + Math.floor(r() * (SCHEDULE.depart - SCHEDULE.boardOpen - 30)),
        manual: false,
        noTapOff: false,
      }));
      buses.push({ id: `B${buses.length + 1}`, label: `${shortName(s.from.name)} → ${shortName(to.name)}`, from: { name: s.from.name, loc: s.from.loc }, to: { name: to.name, loc: to.loc }, route, roster });
    }
  }
  // One of each anomaly, on different buses, so the agent has something to document.
  const pick = (k: number) => buses[k % buses.length]?.roster;
  pick(0)?.splice(0, 1, { ...pick(0)![0], tapOn: null });
  const m = pick(2);
  if (m) m[1] = { ...m[1], manual: true };
  const nt = pick(4);
  if (nt) nt[2] = { ...nt[2], noTapOff: true };
  return buses;
}

// ---- The morning, step by step ------------------------------------------------------------------------------------

export type Phase = "boarding" | "driving" | "railStop" | "holding" | "alighting" | "done";

export interface BusState {
  id: string;
  phase: Phase;
  route: Route;
  /** The route the bus left with, kept to draw what changed. */
  firstRoute: Route;
  alongM: number;
  loc: LngLat;
  heading: number;
  speed: number;
  /** Index of the next crossing on `route` not yet crossed. */
  nextXing: number;
  /** Until when the bus stays in its current stop (rail stop), or null. */
  until: number | null;
  onBoard: Set<string>;
  tappedOn: Set<string>;
  tappedOff: Set<string>;
  manualTaps: number;
  departedAt: number | null;
  arrivedAt: number | null;
  /** Estimated arrival at the start, for the "late" math. */
  plannedArrival: number;
  /** A stop that isn't a crossing or a campus (traffic, a breakdown), for the scenario. */
  stall: { from: number; to: number } | null;
}

export type SimEvent =
  | { t: number; kind: "gps"; bus: string; loc: LngLat; speed: number; heading: number }
  | { t: number; kind: "door"; bus: string; open: boolean; where: string }
  | { t: number; kind: "tap"; bus: string; tag: string; dir: "on" | "off"; method: "badge" | "manual"; where: string }
  | { t: number; kind: "railStop"; bus: string; xing: string; label: string }
  | { t: number; kind: "holding"; bus: string; xing: string; label: string }
  | { t: number; kind: "arrive"; bus: string; where: string }
  | { t: number; kind: "depart"; bus: string; where: string };

/** A blockage source: the scenario's scripted train, or a live Train Watch reading. */
export interface Blockage { xing: string; from: number; to: number; source: "scenario" | "trainwatch"; estimate: string | null }

export interface World {
  t: number;
  buses: Bus[];
  state: Map<string, BusState>;
  blockages: Blockage[];
}

const travelS = (m: number, crossings: number) => m / SCHEDULE.speed + crossings * SCHEDULE.railStopS;

export function startWorld(buses: Bus[], blockages: Blockage[] = [], stalls: Record<string, { from: number; to: number }> = {}): World {
  const state = new Map<string, BusState>();
  for (const b of buses) {
    const p = pointAt(b.route, 0);
    state.set(b.id, {
      id: b.id, phase: "boarding", route: b.route, firstRoute: b.route, alongM: 0, loc: p.loc, heading: p.heading, speed: 0,
      nextXing: 0, until: null, onBoard: new Set(), tappedOn: new Set(), tappedOff: new Set(), manualTaps: 0,
      departedAt: null, arrivedAt: null,
      plannedArrival: Math.round(SCHEDULE.depart + travelS(b.route.lengthM, b.route.crossings.filter((c) => c.atGrade).length)),
      stall: stalls[b.id] ?? null,
    });
  }
  return { t: SCHEDULE.start, buses, state, blockages };
}

export const isBlocked = (w: World, xing: string, t = w.t) => w.blockages.find((b) => b.xing === xing && t >= b.from && t < b.to) ?? null;

/** Seconds left on the route from where the bus is, at the plan's speed, plus rail stops ahead. */
export function etaS(s: BusState, t: number): number {
  if (s.arrivedAt !== null) return s.arrivedAt;
  const start = s.phase === "boarding" ? SCHEDULE.depart : t;
  const ahead = s.route.crossings.slice(s.nextXing).filter((c) => c.atGrade).length;
  return Math.round(start + travelS(s.route.lengthM - s.alongM, ahead) + (s.until && s.phase !== "boarding" ? Math.max(0, s.until - t) : 0));
}

/** Advance the world by `dt` seconds (keep dt ≤ 5 for smooth GPS). Returns what the bus hardware would report. */
export function step(w: World, dt: number): SimEvent[] {
  const out: SimEvent[] = [];
  const t0 = w.t, t1 = w.t + dt;
  for (const b of w.buses) {
    const s = w.state.get(b.id)!;
    if (s.phase === "boarding") {
      if (t0 < SCHEDULE.boardOpen && t1 >= SCHEDULE.boardOpen) out.push({ t: SCHEDULE.boardOpen, kind: "door", bus: b.id, open: true, where: b.from.name });
      for (const r of b.roster) {
        if (r.tapOn !== null && r.tapOn >= t0 && r.tapOn < t1) {
          s.onBoard.add(r.tag); s.tappedOn.add(r.tag);
          if (r.manual) s.manualTaps++;
          out.push({ t: r.tapOn, kind: "tap", bus: b.id, tag: r.tag, dir: "on", method: r.manual ? "manual" : "badge", where: b.from.name });
        }
      }
      if (t1 >= SCHEDULE.depart) {
        s.phase = "driving"; s.departedAt = SCHEDULE.depart;
        out.push({ t: SCHEDULE.depart, kind: "door", bus: b.id, open: false, where: b.from.name });
        out.push({ t: SCHEDULE.depart, kind: "depart", bus: b.id, where: b.from.name });
      }
      continue;
    }
    if (s.phase === "done") continue;
    if (s.phase === "alighting") {
      if (s.until !== null && t1 >= s.until) {
        s.phase = "done"; s.until = null;
        out.push({ t: t1, kind: "door", bus: b.id, open: false, where: b.to.name });
      }
      continue;
    }
    if (s.phase === "railStop" || s.phase === "holding") {
      const x = s.route.crossings[s.nextXing];
      const blocked = x && isBlocked(w, x.xing.id, t1);
      if (s.phase === "holding" && !blocked) { s.phase = "railStop"; s.until = t1 + SCHEDULE.railStopS; }
      if (s.phase === "railStop" && s.until !== null && t1 >= s.until) { s.phase = "driving"; s.until = null; s.nextXing++; }
      s.speed = 0;
      out.push({ t: t1, kind: "gps", bus: b.id, loc: s.loc, speed: 0, heading: s.heading });
      continue;
    }
    // Driving.
    if (s.stall && t1 >= s.stall.from && t0 < s.stall.to) {
      s.speed = 0;
      out.push({ t: t1, kind: "gps", bus: b.id, loc: s.loc, speed: 0, heading: s.heading });
      continue;
    }
    const x = s.route.crossings[s.nextXing];
    let target = s.alongM + SCHEDULE.speed * dt;
    if (x && target >= x.alongM) {
      target = x.alongM;
      if (x.atGrade) {
        const blocked = isBlocked(w, x.xing.id, t1);
        s.phase = blocked ? "holding" : "railStop";
        s.until = blocked ? null : t1 + SCHEDULE.railStopS;
        out.push({ t: t1, kind: blocked ? "holding" : "railStop", bus: b.id, xing: x.xing.id, label: x.label });
      } else s.nextXing++;
    }
    s.alongM = target;
    const p = pointAt(s.route, s.alongM);
    s.loc = p.loc; s.heading = p.heading; s.speed = s.phase === "driving" ? SCHEDULE.speed : 0;
    out.push({ t: t1, kind: "gps", bus: b.id, loc: s.loc, speed: s.speed, heading: s.heading });
    if (s.phase === "driving" && s.alongM >= s.route.lengthM - 0.5) {
      s.phase = "alighting"; s.arrivedAt = Math.round(t1); s.speed = 0; s.until = t1 + SCHEDULE.alightS;
      out.push({ t: t1, kind: "arrive", bus: b.id, where: b.to.name });
      out.push({ t: t1, kind: "door", bus: b.id, open: true, where: b.to.name });
      // Riders tap off over the next minute and a half; the one who forgets doesn't.
      let k = 0;
      for (const r of b.roster) {
        if (!s.onBoard.has(r.tag)) continue;
        s.onBoard.delete(r.tag);
        if (r.noTapOff) continue;
        s.tappedOff.add(r.tag);
        out.push({ t: t1 + 5 + 4 * k++, kind: "tap", bus: b.id, tag: r.tag, dir: "off", method: r.manual ? "manual" : "badge", where: b.to.name });
      }
    }
  }
  w.t = t1;
  return out;
}

/**
 * The demo morning: a train stops across Pleasantville Dr, the busiest crossing on the walks with no Train Watch
 * sensor (public/data/sensor_gaps.json), as the Port Houston bus approaches; and the McReynolds bus stops for three
 * minutes with nothing to explain it. Both invented, and labeled so on the page.
 */
export function demoScenario(buses: Bus[]): { blockages: Blockage[]; stalls: Record<string, { from: number; to: number }> } {
  const blockages: Blockage[] = [];
  const stalls: Record<string, { from: number; to: number }> = {};
  const ph = buses.find((b) => b.route.crossings.some((c) => /pleasantville/i.test(c.label)));
  const x = ph?.route.crossings.find((c) => /pleasantville/i.test(c.label));
  if (x) blockages.push({ xing: x.xing.id, from: at(7, 12, 30), to: at(7, 22), source: "scenario", estimate: "9 MIN" });
  const mc = buses.find((b) => /^McReynolds/.test(b.label));
  if (mc) stalls[mc.id] = { from: at(7, 14), to: at(7, 17) };
  return { blockages, stalls };
}
