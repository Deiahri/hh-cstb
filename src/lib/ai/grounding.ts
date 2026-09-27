// What the explainer and the walkway helper know about one home: the facts the /walk screen already shows, as a small
// JSON object. It carries no address and no coordinates, so a child's home location never leaves the browser.
import { stepText } from "../../components/CrossingPlan";
import type { Hazard, RouteResult } from "../analyze";
import { type WalkPlan, zonePossible } from "../crossings";
import type { AppData } from "../data";
import { METERS_PER_MILE } from "../geo";
import { mi } from "../format";
import { DICTS, type Lang, dataText } from "../i18n";
import { type Walk, crossCounts, zoneStreets } from "../walk";
import type { GroundCrossing, GroundWalk, WalkGrounding } from "./types";

const miles = (m: number) => Math.round((m / METERS_PER_MILE) * 100) / 100;

const ZONE_PATH = {
  borders: "borders the school",
  "thoroughfare-collector": "thoroughfare or collector",
  neither: "neither (local street)",
} as const;

function lists(h: Hazard): string[] {
  return [
    h.kind === "rail" && "active railroad",
    h.pedDangerous && "City list: dangerous for people walking (2022)",
    h.highInjury && "City High Injury Network (2022)",
  ].filter((x): x is string => !!x);
}

function groundWalk(d: AppData, w: Walk, route: RouteResult, plan: WalkPlan | undefined, lang: Lang): GroundWalk {
  const t = DICTS[lang];
  const zones = zoneStreets(d, w);
  const crossings: GroundCrossing[] = (plan?.steps ?? []).map((step) => {
    const h = step.hazard;
    const z = zones.find((x) => x.hazard.key === h.key);
    const c: GroundCrossing = {
      kind: h.kind,
      name: h.kind === "rail" ? t.hazard.railName(h.key.slice(5)) : h.name,
      lists: lists(h),
      whereToCross: stepText(step, t, lang).text,
      controlNearby: step.near,
    };
    if (h.kind === "road") {
      c.pedCrashesOnSegment = h.pedCrashes;
      c.pedDeathsOnSegment = h.pedDeaths;
      c.schoolZone = z?.path ? ZONE_PATH[z.path] : "unknown";
      c.streetOwner = z?.owner ?? null;
    }
    return c;
  });
  return { to: route.school.name, miles: miles(route.distance), crossings };
}

/** Who can change the crossings with nothing controlled close by, in the page's own words (as <WhoCanChange> says it). */
function whoCanChange(d: AppData, w: Walk, lang: Lang): string[] {
  const t = DICTS[lang];
  const school = w.r.now?.school.name ?? "";
  const far = w.plans.flatMap((p) => p.steps).filter((s) => !s.near);
  const roads = far.filter((s) => s.hazard.kind === "road");
  const out: string[] = [];
  if (roads.length) {
    const zone = roads.map((s) => {
      const row = d.corridors.find((c) => c.key === s.hazard.key);
      return row ? zonePossible(row) : null;
    });
    out.push(zone.every((z) => z === false) ? t.cross.whoRoadNoZone(school) : t.cross.whoRoad(school));
  }
  if (far.some((s) => s.hazard.kind === "rail")) out.push(t.cross.whoRail);
  return out;
}

export function walkGrounding(d: AppData, w: Walk, lang: Lang): WalkGrounding | null {
  const { r, sw, shuttle } = w;
  const now = r.now;
  if (!now) return null;
  const t = DICTS[lang];
  const c = crossCounts(now.hazards);
  const g: WalkGrounding = {
    closedZone: r.closedZone,
    thisYearSchool: now.school.name,
    thisYearSchoolAddress: now.school.address,
    headline: t.wc.verdict(now.school.name, c.rail, c.roads),
    prek: w.prek,
    walkToSchool: groundWalk(d, w, now, w.nowPlan, lang),
    twoMileRule: now.distance >= 2 * METERS_PER_MILE ? "2 miles or more: ask about the regular bus" : "under 2 miles: no bus for distance",
    whoCanChange: whoCanChange(d, w, lang),
    pageSays: [
      now.distance >= 2 * METERS_PER_MILE ? t.result.over2(mi(now.distance), now.school.name)
        : sw ? t.result.cliff(mi(now.distance), now.school.name) : t.result.under2(mi(now.distance), now.school.name),
      ...(w.prek ? [t.result.preK] : []),
      ...(c.rail || (sw && crossCounts(sw.hazards).rail) ? [t.result.railNote] : []),
    ],
    dataNotes: [
      "Walks are straight lines from home to school, so a walk on real streets crosses at least these roads and tracks.",
      "Only traffic lights and public rail crossings are known. Crossing guards, stop signs and marked crosswalks aren't in any public Houston data.",
      "Crash counts are the City of Houston's 2022 lists, the newest the City publishes.",
      "Houston publishes no sidewalk data, so the app can't say whether there's a sidewalk.",
      "HISD decides bus service. The City decides school zones and crossing guards. This app decides nothing.",
      "HISD's closure family line: 713-556-7121.",
    ],
  };
  if (r.closedZone && r.old) {
    g.lastYearSchool = r.old.school.name;
    g.lastYearMiles = miles(r.old.distance);
  }
  if (shuttle && !shuttle.sameSite && sw) {
    g.shuttle = {
      pickupAt: shuttle.from.name,
      pickupAddress: shuttle.from.address,
      dropOff: shuttle.to.map((x) => (x.grades ? `${x.name} (${dataText(lang, x.grades)})` : x.name)).join(" / "),
      runs: "2026–27 and 2027–28 school years only",
      walkToPickup: groundWalk(d, w, sw, w.swPlan, lang),
      stopAndTimesPublished: false,
    };
  }
  return g;
}
