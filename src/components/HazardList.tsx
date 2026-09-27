import type { Hazard } from "../lib/analyze";
import type { Dict } from "../lib/i18n";

export function Tags({ h, t }: { h: Hazard; t: Dict }) {
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
