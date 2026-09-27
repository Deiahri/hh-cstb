import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../lib/data";
import { askAI, useAiStatus } from "../lib/ai/client";
import { TRAIN_WATCH_PAGE } from "../lib/live";
import { useTrainWatch } from "../lib/useTrainWatch";
import { type Agent, type LogEntry, logText, newAgent, runAgent } from "../lib/sim/agent";
import { type Blockage, type Phase, type SimEvent, type World, SCHEDULE, demoScenario, etaS, hhmm, isBlocked, makeBuses, startWorld, step } from "../lib/sim/model";
import { closedZones } from "../lib/ui/model";
import { Back } from "../components/ui/bits";
import { LiveMap, type MapDot, type MapLine } from "../components/ui/LiveMap";
import { usePhone } from "../components/ui/WcMap";
import { Eyebrow, StaffNav } from "./Staff";

// Staff page, in English. A simulated morning on the closure shuttles: see src/lib/sim/model.ts for what's real
// (campuses, tracks, public crossings, live Train Watch) and what's invented (buses' movements, riders, tags).

const SPEEDS = [10, 30, 60] as const;
const TICK_MS = 200;
const PHASE: Record<Phase, string> = {
  boarding: "Boarding", driving: "Driving", railStop: "Stopped at rail crossing", holding: "Waiting for a train",
  alighting: "Riders getting off", done: "Done",
};
const KIND_LABEL: Record<LogEntry["kind"], string> = {
  depart: "Departed", reroute: "Rerouted", hold: "Holding", stop: "Stop", late: "Late", arrive: "Arrived", reconcile: "Taps checked", roster: "Roster",
};
type Tap = Extract<SimEvent, { kind: "tap" }>;

export default function Sim() {
  const d = useData();
  const ai = useAiStatus();
  const buses = useMemo(() => makeBuses(d.shuttles.shuttles, d.ds), [d]);
  const monitored = useMemo(() => new Set((d.trainwatch?.sensors ?? []).map((s) => s.id)), [d.trainwatch]);
  const [scenario, setScenario] = useState(true);
  const [useLive, setUseLive] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(30);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);
  const world = useRef<World | null>(null);
  const agent = useRef<Agent>(newAgent());
  const taps = useRef<Tap[]>([]);
  const [report, setReport] = useState<{ text: string; mock?: boolean } | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useTrainWatch(useLive && !!d.trainwatch);
  const phone = usePhone();
  const zones = useMemo(() => closedZones(d).map((z) => z.rings), [d]);
  const fit = useMemo(() => buses.flatMap((b) => b.route.points), [buses]);

  const reset = () => {
    const sc = scenario ? demoScenario(buses) : { blockages: [], stalls: {} };
    world.current = startWorld(buses, sc.blockages, sc.stalls);
    agent.current = newAgent();
    taps.current = [];
    setReport(null);
    setRunning(false);
    force((n) => n + 1);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [buses, scenario]);

  // Live Train Watch readings become blockages on any crossing a route uses, refreshed every tick while they last.
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const w = world.current;
      if (!w) return;
      if (w.t >= SCHEDULE.end || [...w.state.values()].every((s) => s.phase === "done")) { setRunning(false); return; }
      const lv = liveRef.current;
      w.blockages = w.blockages.filter((b) => b.source !== "trainwatch");
      if (useLive) {
        for (const s of lv.byId.values()) {
          if (!s.blocked) continue;
          const onRoute = [...w.state.values()].some((st) => st.route.crossings.some((c) => c.xing.id === s.id));
          if (onRoute) w.blockages.push({ xing: s.id, from: w.t - 1, to: w.t + 60, source: "trainwatch", estimate: s.timeToClear } satisfies Blockage);
        }
      }
      let left = (TICK_MS / 1000) * speed;
      while (left > 0) {
        const dt = Math.min(5, left);
        left -= dt;
        const ev = step(w, dt);
        for (const e of ev) if (e.kind === "tap") taps.current.push(e);
        runAgent(agent.current, w, ev, d.ds);
      }
      force((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, speed, useLive, d.ds]);

  const w = world.current;
  if (!w) return null;
  const log = agent.current.log;
  const finished = w.t >= SCHEDULE.end || [...w.state.values()].every((s) => s.phase === "done");
  const routeXings = [...w.state.values()].flatMap((s) => s.route.crossings.filter((c) => c.atGrade));
  const tapsOn = [...w.state.values()].reduce((a, s) => a + s.tappedOn.size, 0);
  const liveBlockedOnRoutes = w.blockages.filter((b) => b.source === "trainwatch");

  const lines: MapLine[] = w.buses.flatMap((b) => {
    const s = w.state.get(b.id)!;
    const changed = s.route !== s.firstRoute;
    return [
      ...(changed ? [{ id: `${b.id}-was`, coords: s.firstRoute.points, color: "#8a8f8c", width: 3, dashed: true }] : []),
      { id: b.id, coords: s.route.points, color: changed ? "#1d4ed8" : "#1F6E5A", width: 4 },
    ];
  });
  const dots: MapDot[] = routeXings.filter((c, i, a) => a.findIndex((x) => x.xing.id === c.xing.id) === i).map((c) => {
    const blk = isBlocked(w, c.xing.id);
    return {
      id: c.xing.id, loc: c.xing.loc, r: monitored.has(c.xing.id) ? 8 : 6, fill: blk ? "#b91c1c" : "#6D4FB3", stroke: monitored.has(c.xing.id) ? "#1F6E5A" : "#ffffff",
      title: `${c.label}: ${blk ? `blocked (${blk.source === "trainwatch" ? "live" : "demo"})` : "no train"}, ${monitored.has(c.xing.id) ? "Train Watch sensor" : "no sensor"}`,
    };
  });

  const writeReport = async () => {
    setBusy(true);
    const r = await askAI({ mode: "dispatch", lang: "en", log: logText(agent.current), messages: [{ role: "user", text: "Write the day report." }] });
    setReport(r.ok ? { text: r.text, mock: r.mock } : { error: r.error === "unavailable" ? "The AI function is off on this host." : "The report didn't come back. Try again." });
    setBusy(false);
  };

  return (
    <section className="screen wide sim">
      <Back />
      <Eyebrow extra="Simulation" />
      <p className="sim-banner"><strong>Simulation.</strong> The buses, riders and badge tags are invented. The campuses, the tracks, the public crossings and the live Train Watch readings are real.</p>
      <h1>Closure shuttles: a simulated morning</h1>
      <p className="lede">
        One bus for each pickup-to-school pairing HISD announced. Each bus reports what its tracking unit would: position, speed,
        doors, and a stop at every at-street-level rail crossing (buses carrying passengers stop at each, 49 CFR 392.10). Riders tap a
        badge on and off, the way HISD's SMARTtag works. A dispatch agent reads all of it. It changes a route when a crossing ahead
        is blocked, and it writes down everything that happens.
      </p>

      <div className="sim-controls">
        <button type="button" className="btn inline" onClick={() => setRunning(!running)} disabled={finished}>
          {finished ? "Morning done" : running ? "Pause" : w.t === SCHEDULE.start ? "Start the morning" : "Resume"}
        </button>
        <button type="button" className="btn secondary inline" onClick={reset}>Reset</button>
        <label>Speed{" "}
          <select value={speed} onChange={(e) => setSpeed(+e.target.value as (typeof SPEEDS)[number])}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <label><input type="checkbox" checked={scenario} onChange={(e) => setScenario(e.target.checked)} /> Demo events (a train at Pleasantville Dr, a stop on the McReynolds run)</label>
        <label><input type="checkbox" checked={useLive} onChange={(e) => setUseLive(e.target.checked)} disabled={!d.trainwatch} /> Live Train Watch</label>
        <span className="sim-clock" aria-live="off">{hhmm(w.t)}</span>
      </div>
      {useLive && (
        <p className="small muted">
          <a href={TRAIN_WATCH_PAGE} target="_blank" rel="noopener">Train Watch</a>{" "}
          {live.at ? `read ${new Date(live.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` : live.error ? "didn't answer" : "loading"}.{" "}
          {buses.flatMap((b) => b.route.crossings).filter((c) => monitored.has(c.xing.id)).map((c) => c.label).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "No"} crossing on these routes has a sensor.{" "}
          {liveBlockedOnRoutes.length ? `Blocked right now: ${liveBlockedOnRoutes.length}.` : "None is blocked right now."}
        </p>
      )}

      <div className="sim-split">
        <div className="sim-map">
          <LiveMap height={phone ? 360 : 520} zones={zones} fit={fit} lines={lines} dots={dots}
            pins={w.buses.map((b) => { const s = w.state.get(b.id)!; return { id: b.id, loc: s.loc, label: b.id, cls: `simbus${s.phase === "holding" ? " is-holding" : ""}` }; })} />
          <p className="small muted">
            Amber: a bus. Purple dot: an at-grade crossing on a route (red when blocked, green ring when the City has a sensor there). Dashed gray: the route before
            the agent changed it. Buses drive straight lines between the crossings they use, since the walking routes cover people on foot, not buses.
          </p>
        </div>

        <div className="sim-side">
          <h2>Dispatch log <span className="small muted">({log.length} entries, {agent.current.reroutes} reroute{agent.current.reroutes === 1 ? "" : "s"})</span></h2>
          <ol className="sim-log" reversed>
            {[...log].reverse().map((e) => (
              <li key={e.id} className={`k-${e.kind}`}>
                <span className="small muted">[{e.id}] {hhmm(e.t)} · {KIND_LABEL[e.kind]}{e.source ? ` · ${e.source}` : ""}</span>
                <div>{e.text}</div>
              </li>
            ))}
            {!log.length && <li className="muted">Nothing yet. Start the morning.</li>}
          </ol>
        </div>
      </div>

      <h2>Buses</h2>
      <div className="table-scroll">
        <table className="tbl">
          <thead><tr><th>Bus</th><th>Status</th><th>On board</th><th>Tapped on / off</th><th>Arrival</th><th>Route</th></tr></thead>
          <tbody>
            {w.buses.map((b) => {
              const s = w.state.get(b.id)!;
              const eta = etaS(s, w.t);
              const late = eta - s.plannedArrival;
              return (
                <tr key={b.id}>
                  <td className="name"><b>{b.id}</b> {b.label}</td>
                  <td>{PHASE[s.phase]}{s.speed > 0 && <span className="small muted"> · {Math.round(s.speed * 2.237)} mph</span>}</td>
                  <td>{s.onBoard.size}</td>
                  <td>{s.tappedOn.size} / {s.tappedOff.size}{s.manualTaps ? <span className="small muted"> · {s.manualTaps} by hand</span> : null}</td>
                  <td>{s.arrivedAt !== null ? `Arrived ${hhmm(s.arrivedAt)}` : `ETA ${hhmm(eta)}`}{late >= 60 && <span className="small"> (+{Math.round(late / 60)} min)</span>}</td>
                  <td className="small">{(s.route.lengthM / 1609.344).toFixed(1)} mi · {s.route.crossings.filter((c) => c.atGrade).map((c) => c.label).join(", ") || "no at-grade crossing"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sim-split">
        <div>
          <h2>SMARTtag feed (simulated) <span className="small muted">{tapsOn} taps on so far</span></h2>
          <ol className="sim-taps">
            {taps.current.slice(-14).reverse().map((e, i) => (
              <li key={`${e.tag}-${e.dir}-${i}`}><span className="small muted">{hhmm(e.t)}</span> {e.bus} · {e.tag} · tapped {e.dir}{e.method === "manual" ? " (entered by driver)" : ""} · {e.where.replace(/,.*$/, "")}</li>
            ))}
            {!taps.current.length && <li className="muted">No taps yet.</li>}
          </ol>
          <p className="small muted">
            Real SMARTtag records are HISD's, and they're student education records under FERPA, so none are used here. Tags like T-37E0 are random: no names, no student numbers, no home addresses.
          </p>
        </div>
        <div>
          <h2>Day report</h2>
          {!ai.available ? (
            <p className="muted small">The AI function is off on this host. Run <code>npm run dev:full</code> with <code>AI_MOCK=1</code> (or a key) to write the report from the log.</p>
          ) : (
            <>
              <p className="small">The model reads only the log above and cites each entry, like [E15]. The same checks as the assistant run on its answer.</p>
              <button type="button" className="btn inline" onClick={writeReport} disabled={busy || !log.length}>{busy ? "Writing…" : "Write the day report"}</button>
              {report && "text" in report && (
                <>
                  <p className="small muted">AI-written from a simulated log{report.mock ? " (demo reply: no key set)" : ""}. Check the cited entries.</p>
                  <div className="brief">{report.text}</div>
                </>
              )}
              {report && "error" in report && <p className="err">{report.error}</p>}
            </>
          )}
        </div>
      </div>
      <StaffNav />
    </section>
  );
}
