// What the explainer and the walkway helper know about one home: the facts the /walk screen shows, in its own words,
// as a small JSON object. It carries no address and no coordinates, so a child's home location never leaves the browser.
import type { AppData } from "../data";
import { METERS_PER_MILE } from "../geo";
import { type UiCrossing, crossList, crossingAdvice, mi, short, toCheck, toUiResult, whoFor } from "../ui/model";
import { UI } from "../ui/strings";
import type { Walk } from "../walk";
import type { GroundCrossing, GroundWalk, WalkGrounding } from "./types";

type Lang = "en" | "es";
const miles = (m: number) => Math.round((m / METERS_PER_MILE) * 100) / 100;

function lists(c: UiCrossing): string[] {
  if (c.kind === "rail") return ["active railroad"];
  return [c.ped && "City list: dangerous for people walking (2022)", "City High Injury Network (2022)"].filter((x): x is string => !!x);
}

function schoolZone(c: UiCrossing, school: string): GroundCrossing["schoolZone"] {
  const s = c.street;
  if (!s) return "unknown";
  if (s.borders.includes(school)) return "borders the school";
  return s.toc ? "thoroughfare or collector" : "neither (local street)";
}

function groundWalk(to: string, distM: number, list: UiCrossing[], school: string, lang: Lang): GroundWalk {
  const L = UI[lang];
  return {
    to,
    miles: miles(distM),
    crossings: list.map((c) => {
      const g: GroundCrossing = { kind: c.kind, name: c.name, lists: lists(c), whereToCross: crossingAdvice(c, L), controlNearby: c.control.has };
      if (c.kind === "road") {
        g.pedCrashesOnSegment = c.pc;
        g.pedDeathsOnSegment = c.pd;
        g.schoolZone = schoolZone(c, school);
        g.streetOwner = c.street?.owner ?? null;
      }
      return g;
    }),
  };
}

/** A home outside the closed zones: its school's walk, no shuttle, no last year. */
function openGrounding(d: AppData, w: Walk, lang: Lang): WalkGrounding | null {
  const c = toCheck(d, w);
  if (!c) return null;
  const L = UI[lang];
  return {
    closedZone: false,
    thisYearSchool: c.school.name,
    thisYearSchoolAddress: c.school.address,
    headline: L.verdict(short(c.school.name), c.crossings.filter((x) => x.kind === "road").length, c.crossings.filter((x) => x.kind === "rail").length),
    prek: w.prek,
    walkToSchool: groundWalk(c.school.name, c.distM, c.crossings, c.school.name, lang),
    twoMileRule: c.distM >= 2 * METERS_PER_MILE ? "2 miles or more: ask about the regular bus" : "under 2 miles: no bus for distance",
    whoCanChange: [...new Set(c.crossings.map((x) => whoFor(x, c.school.name, L).who))],
    pageSays: [L.note_lines, L.note_lights],
    dataNotes: [
      "This home's school did not close. There is no closure shuttle for it.",
      "Crash counts are the City of Houston's 2022 lists, the newest the City publishes.",
      "Houston publishes no sidewalk data, so the app can't say whether there's a sidewalk.",
      "HISD decides bus service. The City decides school zones and crossing guards. This app decides nothing.",
    ],
  };
}

export function walkGrounding(d: AppData, w: Walk, lang: Lang): WalkGrounding | null {
  const r = toUiResult(d, w);
  if (!r) return openGrounding(d, w, lang);
  const L = UI[lang];
  const to = short(r.recv.name);
  const xb = r.before.length ? L.xsome(crossList(r.before, lang)) : L.xnone;
  // Who can change each crossing, said once per distinct line, as the "Ask:" folds on the page say it.
  const who = [...new Set(r.now.map((c) => whoFor(c, r.recv.name, L).who))];
  return {
    closedZone: true,
    lastYearSchool: r.closed.name,
    lastYearMiles: miles(r.distBeforeM),
    thisYearSchool: r.recv.name,
    thisYearSchoolAddress: r.recv.address,
    headline: L.verdict(to, r.roads, r.rails),
    prek: w.prek,
    walkToSchool: groundWalk(r.recv.name, r.distNowM, r.now, r.recv.name, lang),
    shuttle: {
      pickupAt: r.closed.name,
      pickupAddress: r.closed.address,
      dropOff: r.recv.name,
      runs: "2026–27 and 2027–28 school years only",
      walkToPickup: groundWalk(r.closed.name, r.distBeforeM, r.before, r.recv.name, lang),
      stopAndTimesPublished: false,
    },
    twoMileRule: r.distNowM >= 2 * METERS_PER_MILE ? "2 miles or more: ask about the regular bus" : "under 2 miles: no bus for distance",
    whoCanChange: who,
    pageSays: [
      L.shuttle_b(r.closed.name, r.closed.address, mi(r.distBeforeM), xb),
      L.shuttle_c,
      L.after_b(to, mi(r.distNowM)),
      ...(w.prek ? [L.after_prek] : []),
      L.note_lines,
      L.note_lights,
    ],
    dataNotes: [
      "Crash counts are the City of Houston's 2022 lists, the newest the City publishes.",
      "Houston publishes no sidewalk data, so the app can't say whether there's a sidewalk.",
      "HISD decides bus service. The City decides school zones and crossing guards. This app decides nothing.",
      "The page offers two requests the principal can send: a bus stop request to HISD, and a school zone application to the City by April 15.",
    ],
  };
}
