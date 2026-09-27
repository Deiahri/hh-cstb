import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useT } from "../lib/i18n";

export function DataVintage() {
  const { meta, shuttles } = useData();
  const { t } = useT();
  const n = t.notes;
  const keys = ["zones_old", "zones_new", "schools_old", "schools_new", "rail", "ped_hin", "hin"] as const;
  return (
    <details className="vintage">
      <summary>{n.vintageSummary(meta.fetchedAt.slice(0, 10))}</summary>
      <ul>
        {keys.map((k) => {
          const m = meta[k] as { url: string; count: number; lastEditDate: string | null };
          return (
            <li key={k}>
              <a href={m.url} target="_blank" rel="noreferrer">{n.layers[k]}</a> — {n.features(m.count.toLocaleString(), m.lastEditDate ?? n.unknown)}
            </li>
          );
        })}
        {meta.campus_grounds && (
          <li>
            <a href={meta.campus_grounds.url} target="_blank" rel="noreferrer">{n.grounds}</a> —{" "}
            {n.groundsCount(meta.campus_grounds.count, meta.campus_grounds.lastEditDate ?? n.unknown)}
          </li>
        )}
        {meta.signals && (
          <li>
            <a href={meta.signals.url} target="_blank" rel="noreferrer">{n.signals}</a> —{" "}
            {n.signalsCount(meta.signals.count.toLocaleString(), meta.signals.readOn ?? n.unknown)}
          </li>
        )}
        {meta.rail_crossings && (
          <li>
            <a href={meta.rail_crossings.url} target="_blank" rel="noreferrer">{n.railXings}</a> —{" "}
            {n.railXingsCount(meta.rail_crossings.count.toLocaleString(), meta.rail_crossings.lastEditDate ?? n.unknown)}
          </li>
        )}
        {([["mtfp", n.mtfp], ["centerline", n.centerline]] as const).map(([k, label]) => meta[k] && (
          <li key={k}>
            <a href={meta[k]!.url} target="_blank" rel="noreferrer">{label}</a> — {n.layerEdited(meta[k]!.lastEditDate ?? n.unknown)}
          </li>
        ))}
        <li>
          {n.pairings}{" "}
          {shuttles.sources.map((src, i) => (
            <span key={src.url}>{i > 0 && "; "}<a href={src.url} target="_blank" rel="noreferrer">{src.label}</a></span>
          ))}. {n.pairingsTail}
        </li>
      </ul>
      <p>{n.vintageNote}</p>
    </details>
  );
}

/** The brief's rule: every input's date on the same screen as its answer, not folded away. */
export function DatesLine() {
  const { meta } = useData();
  const { t } = useT();
  const u = t.notes.unknown;
  return (
    <p className="dates small muted">
      {t.dates({
        rail: meta.rail.lastEditDate ?? u,
        zones: meta.zones_new.lastEditDate ?? u,
        schools: meta.schools_new.lastEditDate ?? u,
        lights: meta.signals?.readOn ?? u,
        xings: meta.rail_crossings?.lastEditDate ?? u,
      })}{" "}
      <Link className="no-print" to="/sources">{t.wc.srcLink} ›</Link>
    </p>
  );
}

export function Caveats({ area = false }: { area?: boolean }) {
  const { t } = useT();
  const n = t.notes;
  return (
    <aside className="caveats">
      <p><strong>{n.title}</strong> {n.body}</p>
      {/* The brief's rule: never let a share of area read as a count of children, so this stays in view. */}
      {area && <p><strong>{n.area}</strong></p>}
      <details>
        <summary>{n.more}</summary>
        <p>{n.law}</p>
      </details>
    </aside>
  );
}
