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
