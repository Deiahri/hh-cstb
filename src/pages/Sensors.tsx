// Staff page, in English: the City's Train Watch sensors against the rail crossings the closed zones' walks are told to
// use (public/data/sensor_gaps.json, scripts/fetch-trainwatch.ts), live status for the ones that matter here, and the
// bell-time history once scripts/trainwatch-log.ts has run.
import { useMemo, useState } from "react";
import { type SensorGapRow, useData } from "../lib/data";
import { BELL_WINDOWS, TRAIN_WATCH_PAGE } from "../lib/live";
import { closedZones, short } from "../lib/ui/model";
import { useTrainWatch } from "../lib/useTrainWatch";
import { Back } from "../components/ui/bits";
import { LiveMap } from "../components/ui/LiveMap";
import { usePhone } from "../components/ui/WcMap";
import { Eyebrow, StaffNav } from "./Staff";

const KIND: Record<string, string> = {
  gatesLights: "gates and flashing lights", gates: "gates", lights: "flashing lights", none: "no gates or lights",
  underpass: "street goes under", bridge: "street goes over", path: "path for people walking",
};
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const day = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" });
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const Demo = () => <span className="tag-demo" title="Simulated for the demo, not a real reading">Demo data</span>;

export default function Sensors() {
  const d = useData();
  const g = d.sensorGaps;
  const phone = usePhone();
  const live = useTrainWatch(!!d.trainwatch);
  const [sel, setSel] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const zones = useMemo(() => closedZones(d), [d]);
  const watched = useMemo(() => {
    if (!g) return [];
    const ids = new Set([...g.crossings.filter((c) => c.monitored).map((c) => c.id), ...g.nearbySensors.map((s) => s.id)]);
    return (d.trainwatch?.sensors ?? []).filter((s) => ids.has(s.id));
  }, [g, d.trainwatch]);

  if (!g) {
    return (
      <section className="screen wide">
        <Back />
        <h1>Rail sensors on the walks</h1>
        <p>No sensor data yet. Run <code>npm run trainwatch</code>.</p>
      </section>
    );
  }
  const t = g.totals;
  const gaps = g.crossings.filter((c) => !c.monitored && c.canBlock);
  const shown = all ? gaps : gaps.slice(0, 12);
  const blockedNow = [...live.byId.values()].filter((s) => s.blocked);
  const maxPts = Math.max(...g.crossings.map((c) => c.points));
  const r = (c: SensorGapRow) => 4 + 12 * Math.sqrt(c.points / maxPts);
  const selected = g.crossings.find((c) => c.id === sel);

  return (
    <section className="screen wide">
      <Back />
      <Eyebrow />
      <h1>Rail sensors on the walks: one of the 39 street-level crossings has one</h1>
      <p className="lede muted">
        The City's <a href={TRAIN_WATCH_PAGE} target="_blank" rel="noopener">Train Watch</a> sensors report, about every 30 seconds, whether a
        train is blocking a crossing. This page puts them next to the crossings the closed zones' walks are told to use. Where a sensor exists, the
        family's walk page shows its status live. Where none exists, the list below shows where the next ones would cover the most walks.
      </p>
      <dl className="facts four">
        <div><dt>{t.crossingsUsed}</dt><dd>public rail crossings the walks are told to use</dd></div>
        <div><dt>{t.atGradeUsed}</dt><dd>at street level, where a train can stop across the road</dd></div>
        <div><dt>{t.monitoredUsed}</dt><dd>with a Train Watch sensor ({t.sensorsCitywide} citywide)</dd></div>
        <div><dt>{Math.round((100 * t.pointsWithSensor) / t.railPoints)}%</dt><dd>of sample points that cross tracks have a sensor on that track within 1 km</dd></div>
      </dl>

      <h2>Right now</h2>
      {!live.at ? (
        <p className="muted">{live.error ? "Train Watch didn't answer. Try again in a minute." : "Reading Train Watch…"}</p>
      ) : (
        <>
          <p className="small muted">
            Read {clock(live.at)}. Citywide, {blockedNow.length} of {live.byId.size} sensors show a blocked crossing
            {blockedNow.length ? `: ${blockedNow.map((s) => title(s.street)).join(", ")}` : ""}.
          </p>
          <table className="tbl">
            <thead><tr><th>Sensor on these walks' tracks</th><th>Status</th><th>Since</th><th>City estimate</th></tr></thead>
            <tbody>
              {watched.map((s) => {
                const st = live.byId.get(s.id);
                const used = g.crossings.find((c) => c.id === s.id);
                return (
                  <tr key={s.id}>
                    <td className="name">{title(s.street)}<br /><span className="muted small">FRA {s.id} · {used ? `named on ${used.points} sample points' walks (${used.zones.map(short).join(", ")})` : "on a track the walks cross, within 1 km"}</span></td>
                    <td>{st ? (st.blocked ? <b className="st-blocked">Blocked</b> : "No train") : "n/a"}</td>
                    <td>{st?.blocked && st.startMs ? clock(st.startMs) : ""}</td>
                    <td>{st?.blocked ? st.timeToClear ?? "not given" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h2>Where the next sensors would cover the most walks</h2>
      <p className="muted">
        Street-level public crossings the walk plans name that have no Train Watch sensor, ranked by how many sample points' walks use them. Underpasses and
        bridges are left out, since a train can't block them. "Pickup" is the walk to the old campus, where the closure shuttle picks up through 2027–28. "School"
        is the walk to the new school.
      </p>
      <LiveMap
        height={phone ? 320 : 440}
        zones={zones.map((z) => z.rings)}
        dots={g.crossings.filter((c) => c.canBlock || c.monitored).map((c) => ({
          id: c.id, loc: c.loc, r: r(c), fill: c.monitored ? "#1F6E5A" : "#6D4FB3", stroke: c.id === sel ? "#22302C" : "#ffffff",
          title: `${c.label}: ${c.points} pts, ${c.monitored ? "Train Watch sensor" : "no sensor"}`,
        }))}
        fit={selected ? [selected.loc] : zones.flatMap((z) => z.rings[0])}
        onDot={setSel}
      />
      <p className="small muted">Green: has a Train Watch sensor. Purple: no sensor. Size: sample points whose walk uses it. Tap a dot or a row.</p>
      <table className="tbl">
        <thead><tr><th>Crossing</th><th className="num">Walks (pts)</th><th className="num">Pickup / school</th><th>Closed zones</th><th>Receiving schools</th><th>Railroad</th></tr></thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.id} className={c.id === sel ? "is-sel" : ""} onClick={() => setSel(c.id === sel ? null : c.id)} style={{ cursor: "pointer" }}>
              <td className="name">{c.label}<br /><span className="muted small">FRA {c.id} · {KIND[c.kind] ?? c.kind}</span></td>
              <td className="num">{c.points}</td>
              <td className="num">{c.pickup} / {c.school}</td>
              <td>{c.zones.map(short).join(", ")}</td>
              <td>{c.receiving.map(short).join(", ") || "none"}</td>
              <td>{c.railroad.replace(/ (Company|Railway Company|Association)$/, "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gaps.length > 12 && <button type="button" className="btn secondary inline" onClick={() => setAll(!all)}>{all ? "Show the top 12" : `Show all ${gaps.length}`}</button>}

      <h2>Bell-time history {d.liveHistory?.demo && <Demo />}</h2>
      {!d.liveHistory ? (
        <p className="muted">
          Not logged yet. <code>npm run live:log</code> polls Train Watch every 30 seconds and records each blockage at these crossings.{" "}
          <code>npm run live:log -- --summarize</code> writes the counts for school-day windows ({BELL_WINDOWS.map((w) => `${w.from}–${w.to}`).join(" and ")}, Houston time).
          That turns "trains block the crossing at bell time" from a complaint into a number.
        </p>
      ) : (
        <table className="tbl">
          <thead><tr><th>Crossing</th><th className="num">Bell windows watched</th><th className="num">With a train blocking</th><th className="num">Median min</th><th className="num">Longest</th></tr></thead>
          <tbody>
            {d.liveHistory.crossings.map((c) => (
              <tr key={c.id}><td className="name">{title(c.street)}</td><td className="num">{c.windowsWatched}</td><td className="num">{c.windowsBlocked}</td><td className="num">{c.medianMin ?? "n/a"}</td><td className="num">{c.maxMin ?? "n/a"}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Method</h2>
      <p className="small muted">
        {g.method} Sensors are joined by FRA crossing id (Train Watch's <code>code</code>). Sensor list read {day(g.trainWatchAt)}. The City says it is still adding sensors,
        and that early readings had some false "blocked" states.
      </p>
      <StaffNav />
    </section>
  );
}
