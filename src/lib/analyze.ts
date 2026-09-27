// The one analysis both the precompute and the browser run: given a home
// location, which school was it zoned to in 2025–26, which in 2026–27, and what
// does the straight line to each cross. Everything here is derived from the
// public layers at runtime — no figure is copied from the research report.
import {
  type Feature, type FeatureCollection, type IndexedLine, type IndexedPolygon, type LngLat,
  crossings, haversine, indexLines, indexPolygons, polygonAt,
} from "./geo";
import type { RailXing, Signal } from "./crossings";

export interface SchoolProps { Campus_Nbr: number; Campus_Sho: string; Street_Add: string; Grades_Tau?: string }
export interface ZoneProps { Campus__Number: number; Campus_Short_Name: string; Street_Address: string }
export interface RoadProps { Full_Name: string; ped_crash_count: number; ped_death_count: number; total_crash_count: number; MilesLength: number }
export interface RailProps { RR_COMPANY: string; RR_ABRVN: string; RR_STATUS: string }

export interface RawData {
  schools_old: FeatureCollection<SchoolProps>;
  schools_new: FeatureCollection<SchoolProps>;
  zones_old: FeatureCollection<ZoneProps>;
  zones_new: FeatureCollection<ZoneProps>;
  rail: FeatureCollection<RailProps>;
  ped_hin: FeatureCollection<RoadProps>;
  hin: FeatureCollection<RoadProps>;
  /** Where to cross (scripts/fetch-crossings.ts). Optional so the research scripts' RawData still builds. */
  signals?: Signal[];
  rail_crossings?: RailXing[];
}

export interface School { nbr: number; name: string; address: string; loc: LngLat }

export interface Dataset {
  zonesOld: IndexedPolygon<ZoneProps>[];
  zonesNew: IndexedPolygon<ZoneProps>[];
  schoolsOld: Map<number, School>;
  schoolsNew: Map<number, School>;
  rail: IndexedLine<RailProps>[];
  pedHin: IndexedLine<RoadProps>[];
  hin: IndexedLine<RoadProps>[];
  /** 2025–26 elementary zones whose campus number has no 2026–27 zone. */
  closedIds: Set<number>;
  signals: Signal[];
  railXings: RailXing[];
}

function schoolMap(fc: FeatureCollection<SchoolProps>): Map<number, School> {
  const m = new Map<number, School>();
  for (const f of fc.features as Feature<SchoolProps>[]) {
    if (f.geometry?.type !== "Point") continue;
    const p = f.properties;
    m.set(Number(p.Campus_Nbr), { nbr: Number(p.Campus_Nbr), name: p.Campus_Sho, address: p.Street_Add, loc: f.geometry.coordinates });
  }
  return m;
}

export function buildDataset(raw: RawData): Dataset {
  const zonesOld = indexPolygons(raw.zones_old);
  const zonesNew = indexPolygons(raw.zones_new);
  const newIds = new Set(zonesNew.map((z) => Number(z.props.Campus__Number)));
  const closedIds = new Set(zonesOld.map((z) => Number(z.props.Campus__Number)).filter((n) => !newIds.has(n)));
  return {
    zonesOld, zonesNew, closedIds,
    schoolsOld: schoolMap(raw.schools_old),
    schoolsNew: schoolMap(raw.schools_new),
    rail: indexLines(raw.rail),
    pedHin: indexLines(raw.ped_hin),
    hin: indexLines(raw.hin),
    signals: raw.signals ?? [],
    railXings: raw.rail_crossings ?? [],
  };
}

// ---- Hazards ---------------------------------------------------------------

export interface Hazard {
  key: string; // stable id: "road:LIBERTY RD" or "rail:Union Pacific Railroad Company"
  kind: "road" | "rail";
  name: string;
  pedDangerous: boolean; // on the City's Ped Dangerous Roads layer
  highInjury: boolean;   // on the City's High Injury Network layer
  pedCrashes: number;    // summed over the crossed segment(s)
  pedDeaths: number;
  totalCrashes: number;
  at: LngLat;            // where the straight line crosses it
  lineIds: { layer: "rail" | "pedHin" | "hin"; id: number }[];
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bSsgt\b/, "SSgt");

export function hazardsOnRoute(a: LngLat, b: LngLat, ds: Dataset): Hazard[] {
  const byKey = new Map<string, Hazard>();
  const roadCounts = new Map<string, { ped: [number, number, number]; hin: [number, number, number] }>();

  for (const c of crossings(a, b, ds.rail)) {
    const company = c.line.props.RR_COMPANY || "Railroad";
    const key = `rail:${company}`;
    const h = byKey.get(key) ?? {
      key, kind: "rail" as const, name: `Active railroad — ${company}`, pedDangerous: false, highInjury: false,
      pedCrashes: 0, pedDeaths: 0, totalCrashes: 0, at: c.at, lineIds: [],
    };
    h.lineIds.push({ layer: "rail", id: c.line.id });
    byKey.set(key, h);
  }

  for (const [layer, lines] of [["pedHin", ds.pedHin], ["hin", ds.hin]] as const) {
    for (const c of crossings(a, b, lines)) {
      const raw = (c.line.props.Full_Name || "Unnamed road").trim();
      const key = `road:${raw.toUpperCase()}`;
      const h = byKey.get(key) ?? {
        key, kind: "road" as const, name: titleCase(raw), pedDangerous: false, highInjury: false,
        pedCrashes: 0, pedDeaths: 0, totalCrashes: 0, at: c.at, lineIds: [],
      };
      if (layer === "pedHin") h.pedDangerous = true; else h.highInjury = true;
      h.lineIds.push({ layer, id: c.line.id });
      byKey.set(key, h);
      const rc = roadCounts.get(key) ?? { ped: [0, 0, 0], hin: [0, 0, 0] };
      const t = layer === "pedHin" ? rc.ped : rc.hin;
      t[0] += c.line.props.ped_crash_count ?? 0;
      t[1] += c.line.props.ped_death_count ?? 0;
      t[2] += c.line.props.total_crash_count ?? 0;
      roadCounts.set(key, rc);
    }
  }

  // The two City layers describe overlapping segments; take the larger of the
  // two sums rather than adding them, so nothing is double-counted.
  for (const [key, rc] of roadCounts) {
    const h = byKey.get(key)!;
    h.pedCrashes = Math.max(rc.ped[0], rc.hin[0]);
    h.pedDeaths = Math.max(rc.ped[1], rc.hin[1]);
    h.totalCrashes = Math.max(rc.ped[2], rc.hin[2]);
  }

  // Order along the walk, nearest the home first.
  return [...byKey.values()].sort((x, y) => haversine(a, x.at) - haversine(a, y.at));
}

export const flags = (hs: Hazard[]) => ({
  rail: hs.some((h) => h.kind === "rail"),
  ped: hs.some((h) => h.pedDangerous),
  hin: hs.some((h) => h.highInjury),
  get combined() { return this.rail || this.ped; },
});

// ---- Address analysis ------------------------------------------------------

export interface RouteResult { school: School; distance: number; hazards: Hazard[] }

export interface AddressResult {
  point: LngLat;
  oldZone?: ZoneProps;
  newZone?: ZoneProps;
  /** True when the 2025–26 zone at this point belongs to a campus that closed. */
  closedZone: boolean;
  old?: RouteResult;
  now?: RouteResult;
  /** Hazards on the 2026–27 route that were not on the 2025–26 route. */
  newlyCrossed: Hazard[];
}

export function analyzeAddress(point: LngLat, ds: Dataset): AddressResult {
  const oz = polygonAt(point, ds.zonesOld)?.props;
  const nz = polygonAt(point, ds.zonesNew)?.props;
  const oldSchool = oz ? ds.schoolsOld.get(Number(oz.Campus__Number)) : undefined;
  const newSchool = nz ? ds.schoolsNew.get(Number(nz.Campus__Number)) : undefined;
  const route = (s?: School): RouteResult | undefined =>
    s && { school: s, distance: haversine(point, s.loc), hazards: hazardsOnRoute(point, s.loc, ds) };
  const old = route(oldSchool);
  const now = route(newSchool);
  const oldKeys = new Set(old?.hazards.map((h) => h.key));
  return {
    point, oldZone: oz, newZone: nz, old, now,
    closedZone: !!oz && ds.closedIds.has(Number(oz.Campus__Number)),
    newlyCrossed: now ? now.hazards.filter((h) => !oldKeys.has(h.key)) : [],
  };
}
