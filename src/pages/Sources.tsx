import { type LayerMeta, useData } from "../lib/data";
import { useT } from "../lib/i18n";
import { Back } from "../components/WalkCheck";

// Order: where the walk starts and ends, what it crosses, where to cross it, then what the school-zone pages use.
const KEYS = ["zones_old", "zones_new", "schools_old", "schools_new", "ped_hin", "hin", "rail", "signals", "rail_crossings", "mtfp", "centerline", "campus_grounds"] as const;

/** Every public layer the answers come from: its name (linked), what the app uses it for, and its date. */
export default function Sources() {
  const { meta, shuttles } = useData();
  const { t } = useT();
  const n = t.notes, wc = t.wc;
  const label: Record<(typeof KEYS)[number], string> = {
    ...n.layers, signals: n.signals, rail_crossings: n.railXings, mtfp: n.mtfp, centerline: n.centerline, campus_grounds: n.grounds,
  };
  const rows = KEYS.map((k) => ({ k, m: meta[k] as LayerMeta | undefined })).filter((x): x is { k: (typeof KEYS)[number]; m: LayerMeta } => !!x.m);
  return (
    <section className="screen">
      <Back />
      <h1>{wc.sourcesH1}</h1>
      <p className="lede-wc">{wc.sourcesSub}</p>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr>{wc.srcCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ k, m }) => (
              <tr key={k}>
                <td><a href={m.url} target="_blank" rel="noreferrer">{label[k]}</a></td>
                <td>{wc.srcUse[k]}</td>
                <td>{m.readOn ?? m.lastEditDate ?? m.fetchedAt?.slice(0, 10) ?? n.unknown}</td>
              </tr>
            ))}
            <tr>
              <td>
                {shuttles.sources.map((src, i) => (
                  <span key={src.url}>{i > 0 && "; "}<a href={src.url} target="_blank" rel="noreferrer">{src.label}</a></span>
                ))}
              </td>
              <td>{wc.srcUse.pairings}</td>
              <td>{meta.fetchedAt.slice(0, 10)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">{n.vintageSummary(meta.fetchedAt.slice(0, 10))}. {n.body} {n.area}</p>
    </section>
  );
}
