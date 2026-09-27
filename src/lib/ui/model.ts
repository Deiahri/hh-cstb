// The shapes the Walk Check screens draw from, built on the app's one analysis (analyzeAddress / planWalk, shared with
// scripts/compute.ts). The static build computed these itself from a trimmed copy of the data (ui/geo.js); here they're
// derived, so every number on screen matches the staff pages and the VERIFY report.
import type { Hazard, RouteResult } from "../analyze";
import { type CrossingStep, controlLabel, planWalk } from "../crossings";
import type { AppData, HazardShares } from "../data";
import { type LngLat, METERS_PER_MILE } from "../geo";
import type { Walk } from "../walk";
import type { UiDict } from "./strings";

// ---- Formatting (ui/geo.js) ----------------------------------------------------------------------------------------

/** "Burrus ES" → "Burrus", "Henderson NQ ES" → "Henderson". */
export const short = (n: string) => n.replace(/ (NQ )?ES$/, "");
/** Miles, two decimals, trailing zeros dropped: 1.10 → "1.1". */
export const mi = (m: number) => (m / METERS_PER_MILE).toFixed(2).replace(/\.?0+$/, "");
/** Feet, to the nearest 50, at least 50. */
export const ft = (m: number) => Math.max(50, Math.round((m * 3.28084) / 50) * 50);

/** A City layer name as people write it: "BNSF Railway Company" → "BNSF Railway", "N MAIN ST" → "N Main St". */
export function nice(n: string): string {
  let t = n.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  t = t.replace(/(\d)(St|Nd|Rd|Th)\b/g, (_, d: string, s: string) => d + s.toLowerCase());
  t = t.replace(" Railroad Company", "").replace(" Railway Company", " Railway").replace(" Company", "").replace("Bnsf", "BNSF").replace("Mccarty", "McCarty");
  for (const [a, b] of [["Ih ", "IH "], ["Us ", "US "], ["Sh ", "SH "], ["Fm ", "FM "], [" Ssgt ", " SSgt "], ["Mlk", "MLK"]]) t = t.replace(a, b);
  return t;
}

// ---- The seven closed zones ------------------------------------------------------------------------------------------

export interface UiSchool { nbr: number; name: string; address: string; loc: LngLat; share: number }
export interface UiZone {
  nbr: number;
  name: string;
  address: string;
  loc: LngLat;
  rings: LngLat[][];
  demo: LngLat;
  receiving: UiSchool[];
  medOldM: number;
  medNewM: number;
  pctFarther: number;
  pctOver2New: number;
  maxNewMi: number;
  hazOld: HazardShares;
  hazNew: HazardShares;
  pickupRoads: { name: string; share: number; ped: boolean }[];
  shuttleMi: number;
}

const zoneCache = new WeakMap<AppData, UiZone[]>();
export function closedZones(d: AppData): UiZone[] {
  const hit = zoneCache.get(d);
  if (hit) return hit;
  const nbrOf = (name: string) => d.zoneRequests.schools.find((s) => s.name === name)?.nbr ?? 0;
  const out = d.zones.map((z): UiZone => {
    const sh = d.shuttles.shuttles.find((s) => s.from.nbr === z.nbr);
    return {
      nbr: z.nbr,
      name: z.name,
      address: z.oldSchool?.address ?? "",
      loc: z.oldSchool?.loc ?? z.demoPoint ?? [0, 0],
      rings: z.rings,
      demo: z.demoPoint ?? z.rings[0][0],
      receiving: z.receiving.map((r) => ({ nbr: nbrOf(r.name), name: r.name, address: r.address, loc: r.loc, share: r.share })),
      medOldM: z.medianOldM,
      medNewM: z.medianNewM,
      pctFarther: z.pctFarther,
      pctOver2New: Math.round(z.pctOver2New * 10) / 10,
      maxNewMi: Math.round(z.maxNewMi * 100) / 100,
      hazOld: z.hazardOld,
      hazNew: z.hazardNew,
      pickupRoads: z.pickupRoads.map((p) => ({ name: p.name, share: p.share, ped: p.pedDangerous })),
      shuttleMi: sh?.to[0] ? Math.round(sh.to[0].miles * 100) / 100 : 0,
    };
  });
  zoneCache.set(d, out);
  return out;
}

/** The dates line under a walk: when each public layer was last edited, or read. */
export const dataDates = (d: AppData) => ({
  crash: "2022",
  rail: d.meta.rail.lastEditDate ?? "",
  zones: d.meta.zones_new.lastEditDate ?? "",
  signals: d.meta.signals?.readOn ?? "",
  xings: d.meta.rail_crossings?.readOn ?? d.meta.rail_crossings?.lastEditDate ?? "",
});

// ---- One home's walk --------------------------------------------------------------------------------------------------

export interface UiControl {
  /** A traffic light or public rail crossing within 250 m (about 800 ft) of where the line crosses. */
  has: boolean;
  name?: string;
  d?: number;
  dir?: string;
  loc?: LngLat;
  kind?: "signal" | "xing";
  gates?: boolean;
  flashers?: boolean;
}
export interface UiCrossing {
  key: string;
  kind: "road" | "rail";
  name: string;
  ped: boolean;
  pc: number;
  pd: number;
  at: LngLat;
  control: UiControl;
  /** The City's street facts, for roads the corridor list has: a thoroughfare or collector, which schools it borders. */
  street: { toc: boolean; borders: string[]; owner: string | null } | null;
}
export interface UiResult {
  home: LngLat;
  closed: UiZone;
  recv: { nbr: number; name: string; address: string; loc: LngLat };
  now: UiCrossing[];
  before: UiCrossing[];
  distNowM: number;
  distBeforeM: number;
  roads: number;
  rails: number;
}

function crossing(d: AppData, step: CrossingStep): UiCrossing {
  const h: Hazard = step.hazard, c = step.control;
  const control: UiControl = c
    ? {
        has: step.near,
        name: controlLabel(c),
        d: c.d,
        dir: c.dir.toUpperCase(),
        loc: c.loc,
        kind: c.kind === "signal" ? "signal" : "xing",
        ...(c.kind === "rail" ? { gates: c.xing.gates > 0, flashers: c.xing.flashers > 0 } : {}),
      }
    : { has: false };
  const row = h.kind === "road" ? d.corridors.find((x) => x.key === h.key) : undefined;
  return {
    key: h.key,
    kind: h.kind,
    name: h.kind === "rail" ? nice(h.key.slice(5)) : h.name,
    ped: h.pedDangerous,
    pc: h.pedCrashes,
    pd: h.pedDeaths,
    at: h.at,
    control,
    street: row?.streetClass
      ? { toc: row.streetClass.thoroughfareOrCollector, borders: row.bordersSchool ?? [], owner: row.streetClass.owner }
      : row ? { toc: false, borders: row.bordersSchool ?? [], owner: null } : null,
  };
}

/** The whole answer for one home in a closed zone, or null outside them. */
export function toUiResult(d: AppData, w: Walk): UiResult | null {
  const { r } = w;
  if (!r.closedZone || !r.oldZone || !r.now) return null;
  const closed = closedZones(d).find((z) => z.nbr === Number(r.oldZone!.Campus__Number));
  if (!closed) return null;
  const now = (w.nowPlan?.steps ?? []).map((s) => crossing(d, s));
  const old: RouteResult | undefined = r.old;
  const before = old ? planWalk(w.home, old, d.ds).steps.map((s) => crossing(d, s)) : [];
  const s = r.now.school;
  return {
    home: w.home,
    closed,
    recv: { nbr: s.nbr, name: s.name, address: s.address, loc: s.loc },
    now,
    before,
    distNowM: r.now.distance,
    distBeforeM: old?.distance ?? 0,
    roads: now.filter((c) => c.kind === "road").length,
    rails: now.filter((c) => c.kind === "rail").length,
  };
}

// ---- Words -------------------------------------------------------------------------------------------------------------

/** Where to cross, as the walk page and the walk plan say it. */
export function crossingAdvice(c: UiCrossing, L: UiDict): string {
  const k = c.control;
  if (c.kind === "road") return k.has ? L.adv_sig(k.name, ft(k.d!), k.dir) : L.adv_nosig(k.name ?? "", k.d ? mi(k.d) : "");
  return k.has ? L.adv_x(k.name, ft(k.d!), k.dir, k.gates ? L.gates : k.flashers ? L.flash : "") : L.adv_nox(k.name ?? "", k.d ? mi(k.d) : "");
}

/** "N Main St, train tracks": a list of crossings in running text. */
export const crossList = (list: UiCrossing[], lang: "en" | "es") =>
  list.map((c) => (c.kind === "rail" ? (lang === "es" ? "vías de tren" : "train tracks") : c.name)).join(", ");

/** Who can change one crossing, and the one-line "Ask:" for it. A school zone only where HPW's written rules allow one. */
export function whoFor(c: UiCrossing, r: UiResult, L: UiDict): { ask: string; who: string } {
  if (c.kind === "rail") return { ask: L.ask_rail, who: L.who_rail };
  const s = c.street;
  const zone = !!s && (!s.owner || s.owner === "COH") && (s.toc || s.borders.includes(r.recv.name));
  const p = short(r.recv.name);
  return zone ? { ask: L.ask_toc(p), who: L.who_toc(p) } : { ask: L.ask_local, who: L.who_local };
}

