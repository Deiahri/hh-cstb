import { useData } from "../lib/data";
import { pct } from "../lib/format";
import { NOT_PUBLIC, PICKUP_CAMPUSES, SHUTTLE_SOURCE, SHUTTLE_TERM, SURPLUS } from "../lib/pickups";
import "../april15.css";

/**
 * One card per shuttle pickup: the shuttle, the walk to it (computed), the building's status (on the record), and
 * the three things nobody has published. The blanks are the point: they show where HISD's part of the handoff ends
 * and the City's begins, without claiming more than the record says. Status stays neutral: no alarm on "surplus".
 * What's the same for all seven is said once, above the cards.
 */
export function PickupCards() {
  const { shuttles, zones } = useData();
  const cards = PICKUP_CAMPUSES.map((nbr) => ({
    nbr,
    shuttle: shuttles.shuttles.find((s) => s.from.nbr === nbr),
    zone: zones.find((z) => z.nbr === nbr),
  })).filter((c) => c.shuttle && c.zone);

  return (
    <>
      <div className="note pickup-common">
        <p>
          <strong>All seven buildings.</strong> {SURPLUS.date}: {SURPLUS.text.replace("the building", "each building")} {SURPLUS.sale}{" "}
          <a href={SURPLUS.source.url} target="_blank" rel="noreferrer">{SURPLUS.source.label}</a>.
        </p>
        <p><strong>Not public for any of them:</strong></p>
        <ul>
          {NOT_PUBLIC.map((u) => <li key={u.short}><strong>{u.what}.</strong> {u.ask}</li>)}
        </ul>
      </div>
      <div className="pickup-grid">
        {cards.map(({ nbr, shuttle: s, zone: z }) => {
          const roads = z!.pickupRoads.filter((r) => r.share >= 1);
          return (
            <article key={nbr} className="pickup-card">
              <h3>{s!.from.name} <span className="muted small">{s!.from.address}</span></h3>
              <dl>
                <dt>Shuttle</dt>
                <dd>
                  To {s!.to.map((t) => `${t.name} (${t.miles.toFixed(2)} mi)`).join(" and ")}, {SHUTTLE_TERM}.{" "}
                  <a href={SHUTTLE_SOURCE.url} target="_blank" rel="noreferrer" className="small">{SHUTTLE_SOURCE.label}</a>
                  {s!.flags.map((f) => <div key={f} className="small muted">{f}</div>)}
                </dd>
                <dt>Walk here</dt>
                <dd>
                  The same walk as last year. {pct(z!.hazardOld.combined)} of the old zone crosses a pedestrian-dangerous road or active
                  railroad on the way{z!.hazardOld.rail > 0 ? `, and ${pct(z!.hazardOld.rail)} crosses active track` : ""}.
                  {roads.length > 0 && (
                    <div className="small">Roads crossed most: {roads.map((r) => `${r.name} (${pct(r.share)})`).join(", ")}.</div>
                  )}
                </dd>
                <dt>Building</dt>
                <dd>Declared surplus {SURPLUS.date}. No sale date published.</dd>
                <dt>Not public</dt>
                <dd className="unknowns">
                  {NOT_PUBLIC.map((u) => (
                    <span key={u.short} className="chip-unknown" title={`${u.what}. ${u.ask}`}>{u.short} <span className="who">· ask {u.who}</span></span>
                  ))}
                </dd>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
