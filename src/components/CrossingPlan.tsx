import type { Hazard } from "../lib/analyze";
import { type CrossingStep, NEAR_M, SHOW_FAR_M, type WalkPlan, controlLabel, railKind, zonePossible } from "../lib/crossings";
import { roadCorridorTotals, useData } from "../lib/data";
import { dist } from "../lib/format";
import { type Dict, type Lang, useT } from "../lib/i18n";
import { Tags, hazardName } from "./HazardList";

// Closer than this, the light or crossing is where the line meets the road: no direction to give.
const HERE_M = 40;
// Detours shorter than this read as "almost nothing".
const TRIVIAL_M = 15;

/** Where to cross, in words: the sentences for one crossing, and whose lever it is when there's nowhere close. */
export function stepText(step: CrossingStep, t: Dict, lang: Lang): { text: string; who: "road" | "rail" | null } {
  const c = step.control, h = step.hazard, x = t.cross;
  const d = (m: number) => dist(m, lang);
  const adds = (m: number | null) => (m === null || m < TRIVIAL_M ? x.addsNothing : x.adds(d(m)));
  if (c && step.near) {
    const label = controlLabel(c);
    if (c.kind === "signal")
      return { text: `${c.d < HERE_M ? x.atLightHere(label) : x.atLight(label, d(c.d), x.dirs[c.dir])} ${adds(step.detourM)}`, who: null };
    const kind = x.railKinds[railKind(c.xing)];
    return { text: `${c.d < HERE_M ? x.atRailHere(label, kind) : x.atRail(label, kind, d(c.d), x.dirs[c.dir])} ${adds(step.detourM)}`, who: null };
  }
  const none = h.kind === "road" ? x.noLight(d(NEAR_M)) : x.noRail(d(NEAR_M));
  const nearest = !c
    ? x.noneWithin(d(SHOW_FAR_M))
    : c.kind === "signal"
      ? x.nearestLight(controlLabel(c), d(c.d), x.dirs[c.dir], d(step.detourM ?? 0))
      : x.nearestRail(controlLabel(c), x.railKinds[railKind(c.xing)], d(c.d), x.dirs[c.dir], d(step.detourM ?? 0));
  return { text: `${none} ${nearest}`, who: h.kind };
}

function CrashCounts({ h }: { h: Hazard }) {
  const d = useData();
  const { t } = useT();
  const whole = roadCorridorTotals(d, h.name);
  return (
    <details className="hz-crashes">
      <summary>{t.cross.crashSummary}</summary>
      <div className="hz-counts">{t.hazard.counts(h.pedCrashes, h.pedDeaths)} {t.hazard.whole(whole.miles.toFixed(1), whole.pedCrashes, whole.pedDeaths)}</div>
    </details>
  );
}

/**
 * One walk, crossing by crossing: where to cross first, and the City's crash counts folded away. Who can change a
 * crossing with nothing close is said once for all the walks on a page, in <WhoCanChange>.
 */
export function CrossingPlan({ plan, crashes = true }: { plan: WalkPlan; crashes?: boolean }) {
  const { lang, t } = useT();
  if (!plan.steps.length) return <p className="muted">{t.hazard.none}</p>;
  const nearCount = plan.steps.filter((s) => s.near).length;
  return (
    <>
      <ol className="hazards crossing-plan">
        {plan.steps.map((step) => {
          const h = step.hazard;
          const { text } = stepText(step, t, lang);
          return (
            <li key={h.key} className={step.near ? "near" : "far"}>
              <div className="hz-name">{hazardName(h, t)}</div>
              <Tags h={h} t={t} />
              <p className="cross-line">{text}</p>
              {crashes && h.kind === "road" && <CrashCounts h={h} />}
            </li>
          );
        })}
      </ol>
      {nearCount > 1 && plan.pathDetourM !== null && <p className="small">{t.cross.pathAdds(dist(plan.pathDetourM, lang))}</p>}
    </>
  );
}

/**
 * Who can change the crossings with no traffic light or public rail crossing close by, said once for every walk on
 * the page. `school` is the receiving school, whose principal is the City's contact for a guard or a zone.
 */
export function WhoCanChange({ plans, school }: { plans: WalkPlan[]; school: string }) {
  const d = useData();
  const { t } = useT();
  const farSteps = (kind: "road" | "rail") => plans.flatMap((p) => p.steps).filter((s) => !s.near && s.hazard.kind === kind);
  const names = (steps: CrossingStep[]) => [...new Set(steps.map((s) => hazardName(s.hazard, t)))];
  const roadSteps = farSteps("road");
  const roads = names(roadSteps), rails = names(farSteps("rail"));
  if (!roads.length && !rails.length) return null;
  // Offer a school zone only if one of these streets could have one. Streets outside the closed zones' corridor list
  // have no facts, so the hedged wording stays.
  const zone = roadSteps.map((s) => {
    const row = d.corridors.find((c) => c.key === s.hazard.key);
    return row ? zonePossible(row) : null;
  });
  const noZone = zone.length > 0 && zone.every((z) => z === false);
  return (
    <div className="cross-who">
      {roads.length > 0 && <p><strong>{t.cross.whoLabel} ({roads.join(", ")}):</strong> {noZone ? t.cross.whoRoadNoZone(school) : t.cross.whoRoad(school)}</p>}
      {rails.length > 0 && <p><strong>{t.cross.whoLabel} ({rails.join(", ")}):</strong> {t.cross.whoRail}</p>}
    </div>
  );
}
