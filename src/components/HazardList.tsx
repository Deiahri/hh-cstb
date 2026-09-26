import type { Hazard } from "../lib/analyze";
import { roadCorridorTotals, useData } from "../lib/data";
import { type Dict, useT } from "../lib/i18n";

function Tags({ h, t }: { h: Hazard; t: Dict }) {
  return (
    <span className="tags">
      {h.kind === "rail" && <span className="tag rail">{t.hazard.rail}</span>}
      {h.pedDangerous && <span className="tag ped">{t.hazard.ped}</span>}
      {h.highInjury && <span className="tag hin">{t.hazard.hin}</span>}
    </span>
  );
}

/** A hazard's display name. Rail keys are "rail:<company>"; road names are proper nouns and stay as the City spells them. */
export const hazardName = (h: Hazard, t: Dict) => (h.kind === "rail" ? t.hazard.railName(h.key.slice(5)) : h.name);

export function HazardList({ hazards, empty }: { hazards: Hazard[]; empty?: string }) {
  const d = useData();
  const { t } = useT();
  if (!hazards.length) return <p className="muted">{empty ?? t.hazard.none}</p>;
  return (
    <ol className="hazards">
      {hazards.map((h) => {
        const whole = h.kind === "road" ? roadCorridorTotals(d, h.name) : null;
        return (
          <li key={h.key}>
            <div className="hz-name">{hazardName(h, t)}</div>
            <Tags h={h} t={t} />
            {h.kind === "road" && whole && (
              <div className="hz-counts">
                {t.hazard.counts(h.pedCrashes, h.pedDeaths)} {t.hazard.whole(whole.miles.toFixed(1), whole.pedCrashes, whole.pedDeaths)}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
