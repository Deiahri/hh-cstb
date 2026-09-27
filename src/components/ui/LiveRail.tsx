// Under a rail crossing on the walk page: the City's Train Watch sensor on that track, live. "A train is blocking the
// crossing right now" or "no train there right now", never "clear to cross" (copy rule 4 in src/lib/i18n.ts). Shows
// only where a sensor is within 1 km of where the walk meets the track; polls only while one is on screen.
import { useMemo } from "react";
import { compass, railLabel } from "../../lib/crossings";
import { useData } from "../../lib/data";
import { TRAIN_WATCH_PAGE, sensorForHazard } from "../../lib/live";
import type { UiCrossing } from "../../lib/ui/model";
import { ft } from "../../lib/ui/model";
import { useTrainWatch } from "../../lib/useTrainWatch";
import { useUi } from "./bits";

const DIRS = {
  en: { n: "north", ne: "northeast", e: "east", se: "southeast", s: "south", sw: "southwest", w: "west", nw: "northwest" },
  es: { n: "norte", ne: "noreste", e: "este", se: "sureste", s: "sur", sw: "suroeste", w: "oeste", nw: "noroeste" },
} as const;

export function useTrainSensors() {
  const d = useData();
  return useMemo(() => new Map((d.trainwatch?.sensors ?? []).map((s) => [s.id, s])), [d.trainwatch]);
}

export function LiveRail({ c }: { c: UiCrossing }) {
  const d = useData();
  const { lang, L } = useUi();
  const sensors = useTrainSensors();
  const ws = c.kind === "rail" ? sensorForHazard(c, d.ds, sensors) : null;
  const live = useTrainWatch(!!ws);
  if (!ws) return null;
  const name = railLabel(ws.xing);
  const where = ws.d < 40 ? L.live_at(name) : L.live_near(name, ft(ws.d), DIRS[lang][compass(c.at, ws.xing.loc)]);
  if (!live.at) return <p className="live-line small muted">{live.error ? L.live_stale : L.live_loading}</p>;
  const s = live.byId.get(ws.sensor.id);
  if (!s) return null;
  const clock = new Date(live.at).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  const mins = s.blocked && s.startMs ? Math.max(1, Math.round((live.at - s.startMs) / 60_000)) : null;
  return (
    <div className={`live-line${s.blocked ? " is-blocked" : ""}`} role="status" aria-live="polite">
      <span className="live-dot" aria-hidden="true" />
      <p>
        <strong>{where}:</strong> {s.blocked ? L.live_blocked : L.live_no}
        {mins !== null && <> {L.live_for(mins)}</>}
        {s.blocked && s.timeToClear && <> {L.live_est(s.timeToClear)}</>}
      </p>
      {s.blocked && <p><strong>{L.live_never}</strong></p>}
      <p className="small muted">
        {L.live_checked(clock)} {live.error && L.live_stale} <a href={TRAIN_WATCH_PAGE} target="_blank" rel="noopener">{L.live_src}</a>
      </p>
    </div>
  );
}
