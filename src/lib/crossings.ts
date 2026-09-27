// Where to cross: for each road or track a straight-line walk crosses, the nearest traffic signal on that road or
// the nearest open public crossing of that railroad. Shared by the browser and scripts/compute.ts, and ported from
// research/warning-families/crossing-options.mts so the app reproduces that report's figures.
//
// A signal is "controlled," not "safe": the page never says the second word. Crossing guards, stop signs and marked
// crosswalks aren't in any public Houston layer, so a crossing with a guard shows up here as "no traffic light."
import type { Dataset, Hazard, RouteResult } from "./analyze";
import { type LngLat, haversine } from "./geo";

/** One traffic signal from Houston TranStar's public signal map (scripts/fetch-crossings.ts). */
export interface Signal { src: string; name: string; loc: LngLat }
/** One open public railroad crossing from FRA's Crossing Inventory (Form 71). */
export interface RailXing {
  id: string; street: string; railroad: string; type: string; purpose: string; position: string;
  gates: number; pedGates: number; flashers: number; loc: LngLat;
}

export const ON_ROAD_M = 35; // a signal this close to a segment of the crossed road counts as on that road
export const ON_TRACK_M = 40; // an FRA crossing this close to the crossed railroad counts as on that track
export const NEAR_M = 250; // "cross here" when the control is within this distance of the straight-line crossing
export const SHOW_FAR_M = 1000; // beyond NEAR_M, still name the nearest control up to this distance

// ---- Geometry ----------------------------------------------------------------

function distToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180), ky = 110540;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
function distToParts(p: LngLat, parts: LngLat[][]): number {
  let best = Infinity;
  for (const part of parts) for (let i = 1; i < part.length; i++) best = Math.min(best, distToSegment(p, part[i - 1], part[i]));
  return best;
}
/** Bbox of line parts, padded by `m` metres, for a cheap prefilter. */
function paddedBox(parts: LngLat[][], m: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const part of parts) for (const [x, y] of part) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const dy = m / 110540, dx = m / (111320 * Math.cos((((minY + maxY) / 2) * Math.PI) / 180));
  return (p: LngLat) => p[0] >= minX - dx && p[0] <= maxX + dx && p[1] >= minY - dy && p[1] <= maxY + dy;
}

// ---- Which signals and crossings belong to a road or track ---------------------

// Road names: the City layers say "LIBERTY RD"; TranStar says "Liberty @ Lockwood". Compare the core name.
const SUFFIX = /\b(ST|STREET|RD|ROAD|DR|DRIVE|BLVD|AVE|AVENUE|LN|LANE|PKWY|FWY|HWY|CT|WAY|PL|CIR|TRL|EXPY|FRWY)\b\.?/g;
export const coreName = (s: string) =>
  s.toUpperCase().replace(/[.,]/g, " ").replace(SUFFIX, " ").replace(/^\s*(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+/, "")
    .replace(/\s+/g, " ").trim();

interface Index {
  signalCores: string[][];
  roadParts: Map<string, LngLat[][]>;
  railParts: Map<string, LngLat[][]>;
  onRoad: Map<string, Signal[]>;
  onTrack: Map<string, RailXing[]>;
}
const indexes = new WeakMap<Dataset, Index>();
function index(ds: Dataset): Index {
  let ix = indexes.get(ds);
  if (ix) return ix;
  const roadParts = new Map<string, LngLat[][]>();
  for (const l of [...ds.pedHin, ...ds.hin]) {
    const k = `road:${(l.props.Full_Name || "Unnamed road").trim().toUpperCase()}`;
    roadParts.set(k, [...(roadParts.get(k) ?? []), ...l.parts]);
  }
  const railParts = new Map<string, LngLat[][]>();
  for (const l of ds.rail) {
    const k = `rail:${l.props.RR_COMPANY || "Railroad"}`;
    railParts.set(k, [...(railParts.get(k) ?? []), ...l.parts]);
  }
  ix = {
    signalCores: ds.signals.map((s) => s.name.split("@").map(coreName)),
    roadParts, railParts, onRoad: new Map(), onTrack: new Map(),
  };
  indexes.set(ds, ix);
  return ix;
}

/** Signals on a road (hazard key "road:NAME"): one side of the intersection name matches, or within 35 m of it. */
export function signalsOnRoad(ds: Dataset, key: string): Signal[] {
  const ix = index(ds);
  const hit = ix.onRoad.get(key);
  if (hit) return hit;
  const parts = ix.roadParts.get(key) ?? [];
  const core = coreName(key.slice(5));
  const near = paddedBox(parts, ON_ROAD_M);
  const out = ds.signals.filter((s, i) =>
    (core && ix.signalCores[i].includes(core)) || (near(s.loc) && distToParts(s.loc, parts) <= ON_ROAD_M));
  ix.onRoad.set(key, out);
  return out;
}

/** Open public FRA crossings on a railroad (hazard key "rail:COMPANY"): within 40 m of that company's track. */
export function crossingsOnTrack(ds: Dataset, key: string): RailXing[] {
  const ix = index(ds);
  const hit = ix.onTrack.get(key);
  if (hit) return hit;
  const parts = ix.railParts.get(key) ?? [];
  const near = paddedBox(parts, ON_TRACK_M);
  const out = ds.railXings.filter((c) => near(c.loc) && distToParts(c.loc, parts) <= ON_TRACK_M);
  ix.onTrack.set(key, out);
  return out;
}

// ---- The nearest control for one crossing ---------------------------------------

export type Dir = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
/** Compass direction from a to b, 8 points. */
export function compass(a: LngLat, b: LngLat): Dir {
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), dy = b[1] - a[1];
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = north, clockwise
  return (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const)[Math.round(((deg + 360) % 360) / 45) % 8];
}

export type Control =
  | { kind: "signal"; signal: Signal; loc: LngLat; d: number; dir: Dir }
  | { kind: "rail"; xing: RailXing; loc: LngLat; d: number; dir: Dir };

/** The nearest signal on the crossed road, or the nearest public crossing of the crossed railroad. */
export function controlFor(h: Hazard, ds: Dataset): Control | null {
  if (h.kind === "road") {
    let best: Signal | undefined, d = Infinity;
    for (const s of signalsOnRoad(ds, h.key)) { const e = haversine(h.at, s.loc); if (e < d) { d = e; best = s; } }
    return best ? { kind: "signal", signal: best, loc: best.loc, d, dir: compass(h.at, best.loc) } : null;
  }
  let best: RailXing | undefined, d = Infinity;
  for (const c of crossingsOnTrack(ds, h.key)) { const e = haversine(h.at, c.loc); if (e < d) { d = e; best = c; } }
  return best ? { kind: "rail", xing: best, loc: best.loc, d, dir: compass(h.at, best.loc) } : null;
}

// ---- A walk, crossing by crossing -------------------------------------------------

export interface CrossingStep {
  hazard: Hazard;
  /** Nearest control, or null when there's none on this road or track within SHOW_FAR_M. */
  control: Control | null;
  /** The control is within NEAR_M of where the straight line crosses. */
  near: boolean;
  /** Extra metres to walk home → control → school instead of straight: the honest cost of crossing there. */
  detourM: number | null;
}
export interface WalkPlan {
  steps: CrossingStep[];
  /** Home → each near control, in walk order → school. Null when no crossing has a control within NEAR_M. */
  path: LngLat[] | null;
  /** Extra metres for the whole path over the straight line. */
  pathDetourM: number | null;
}

const pathLength = (pts: LngLat[]) => pts.slice(1).reduce((a, p, i) => a + haversine(pts[i], p), 0);

export function planWalk(home: LngLat, route: RouteResult, ds: Dataset): WalkPlan {
  const dest = route.school.loc;
  const straight = haversine(home, dest);
  const steps = route.hazards.map((hazard): CrossingStep => {
    const c = controlFor(hazard, ds);
    const control = c && c.d <= SHOW_FAR_M ? c : null;
    return {
      hazard, control, near: !!control && control.d <= NEAR_M,
      detourM: control ? pathLength([home, control.loc, dest]) - straight : null,
    };
  });
  const via = steps.filter((s) => s.near).map((s) => s.control!.loc);
  const path = via.length ? [home, ...via, dest] : null;
  return { steps, path, pathDetourM: path ? pathLength(path) - straight : null };
}

// ---- Labels ---------------------------------------------------------------------

const ABBR: Record<string, string> = {
  STREET: "St", ST: "St", DRIVE: "Dr", DR: "Dr", ROAD: "Rd", RD: "Rd", AVENUE: "Ave", AVE: "Ave",
  BOULEVARD: "Blvd", BLVD: "Blvd", LANE: "Ln", LN: "Ln", PARKWAY: "Pkwy", PKWY: "Pkwy",
};
/** "JENSEN DRIVE" → "Jensen Dr", "Courtland ST" → "Courtland St"; "BF 1960 A" keeps its short all-caps codes. */
export function tidyName(s: string): string {
  const shouting = s === s.toUpperCase() || s === s.toLowerCase() || /\b[A-Z]{3,}\b/.test(s);
  return s.replace(/\s+/g, " ").trim().split(" ").map((w, i) => {
    const up = w.toUpperCase();
    // A suffix, not "St." for Saint at the start of a name.
    if (ABBR[up] && i > 0) return ABBR[up];
    if (!shouting || /\d/.test(w) || (w.length <= 2 && w === up)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

/** "Liberty @ Lockwood" → "Liberty & Lockwood". */
export const signalLabel = (s: Signal) => s.name.split("@").map((x) => tidyName(x)).filter(Boolean).join(" & ");

/** How an FRA crossing works for someone on foot. The page turns this into words in each language. */
export type RailKind = "underpass" | "bridge" | "path" | "gatesLights" | "gates" | "lights" | "none";
export function railKind(x: RailXing): RailKind {
  if (x.position === "RR Over") return "underpass"; // the railroad passes over the street
  if (x.position === "RR Under") return "bridge"; // the street passes over the railroad
  if (/ped/i.test(x.purpose)) return "path";
  if (x.gates > 0 && x.flashers > 0) return "gatesLights";
  if (x.gates > 0) return "gates";
  if (x.flashers > 0) return "lights";
  return "none";
}
export const railLabel = (x: RailXing) => tidyName(x.street || "Unnamed crossing");
export const controlLabel = (c: Control) => (c.kind === "signal" ? signalLabel(c.signal) : railLabel(c.xing));

// ---- City school zones (HPW School Coordination Program) ----------------------------

/** Street facts from the City's thoroughfare plan and centerline (scripts/fetch-streets.ts), per corridor row. */
export interface StreetFacts {
  streetClass?: { type: string | null; owner: string | null; thoroughfareOrCollector: boolean } | null;
  bordersSchool?: string[];
}
/**
 * Can the principal apply for a City school zone on this street? HPW: the street must be City-owned, and either
 * border the school or be a thoroughfare or collector. Null when the street facts haven't been fetched.
 */
export function zonePossible(f: StreetFacts): boolean | null {
  if (!f.streetClass) return null;
  const cityOwned = f.streetClass.owner === "COH" || f.streetClass.owner === null;
  return cityOwned && ((f.bordersSchool ?? []).length > 0 || f.streetClass.thoroughfareOrCollector);
}
