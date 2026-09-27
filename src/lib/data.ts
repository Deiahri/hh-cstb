// Loads the snapshot written by scripts/fetch-data.ts and scripts/compute.ts.
import { createContext, useContext } from "react";
import { type Dataset, type RawData, buildDataset } from "./analyze";
import type { LngLat } from "./geo";
import type { RailKind } from "./crossings";

/** `readOn` (Houston date) is set on lists that carry no edit date of their own (the signal feed), so the page can say when it was read. */
export interface LayerMeta { label: string; url: string; count: number; lastEditDate: string | null; fetchedAt?: string; readOn?: string }
type SnapshotLayer = "schools_old" | "schools_new" | "zones_old" | "zones_new" | "rail" | "ped_hin" | "hin";
export type Meta = {
  fetchedAt: string; campus_grounds?: LayerMeta; signals?: LayerMeta; rail_crossings?: LayerMeta; mtfp?: LayerMeta; centerline?: LayerMeta;
} & Record<SnapshotLayer, LayerMeta>;

export interface HazardShares { ped: number; hin: number; rail: number; combined: number }
export interface ZoneStat {
  nbr: number;
  name: string;
  oldSchool?: { name: string; address: string; loc: LngLat };
  receiving: { name: string; address: string; loc: LngLat; share: number }[];
  receivingByCampusPoint: string | null;
  points: number;
  medianOldM: number;
  medianNewM: number;
  medianDeltaM: number;
  maxNewMi: number;
  meanNewMi: number;
  pctFarther: number;
  pctOver2Old: number;
  pctOver2New: number;
  pctOver15New: number;
  hazardOld: HazardShares;
  hazardNew: HazardShares;
  /** The roads the walk to the old campus (the shuttle pickup) crosses most, as shares of the zone. */
  pickupRoads: { name: string; share: number; pedDangerous: boolean }[];
  rings: LngLat[][];
  demoPoint: LngLat | null;
}
export interface Totals {
  points: number;
  spacingM: number;
  pctOver2New: number;
  pctOver15New: number;
  hazardOld: HazardShares;
  hazardNew: HazardShares;
  closedZones: number;
  zonesOld: number;
  zonesNew: number;
  schoolsOld: number;
  schoolsNew: number;
  computedAt: string;
}
export interface CorridorStat {
  key: string;
  kind: "road" | "rail";
  name: string;
  pedDangerous: boolean;
  highInjury: boolean;
  pointsNewRoute: number;
  pointsOldRoute: number;
  pointsNewlyCrossed: number;
  zones: string[];
  pedCrashes: number;
  pedDeaths: number;
  totalCrashes: number;
  segments: { layer: "rail" | "pedHin" | "hin"; id: number }[];
  /** Receiving schools whose walks cross it: their principals are the City's contact for a zone or a guard. */
  receiving: string[];
  /** Is there a traffic light (roads) or open public crossing (rail) near where the new walks cross it? */
  control: {
    crossings: number;
    within250Pct: number;
    within500Pct: number;
    medianM: number | null;
    controlsWithin500: number;
    nearest: string | null;
    /** none: nothing within 500 m of any crossing point; far: under half within 250 m; near: the rest. */
    status: "none" | "far" | "near";
  };
  controls: { label: string; kind: "signal" | "rail"; loc: LngLat; railKind?: RailKind }[];
  /** From the City's Major Thoroughfare and Freeway Plan (scripts/fetch-streets.ts); absent until that runs. */
  streetClass?: { type: string | null; owner: string | null; thoroughfareOrCollector: boolean } | null;
  /** Receiving schools whose grounds this street borders (HPW's other school-zone path). */
  bordersSchool?: string[];
}

/** One end of a closure shuttle: a campus, and the OSM grounds its (unpublished) stop is somewhere on. */
export interface ShuttleEnd {
  nbr: number;
  name: string;
  address: string;
  loc: LngLat;
  grounds: LngLat[][][] | null;
}
export interface ShuttleStat {
  from: ShuttleEnd;
  to: (ShuttleEnd & { grades: string | null; miles: number })[];
  /** Pickup and drop-off are the same building: no trip. */
  sameSite: boolean;
  flags: string[];
}
export interface Shuttles { sources: { label: string; url: string }[]; shuttles: ShuttleStat[] }

/**
 * HPW's written paths to a school zone: the street "borders the school", or it is "a thoroughfare or collector";
 * "neither" means neither applies on paper. HPW decides after its own study (scripts/compute.ts, zone_requests.json).
 */
export type ZonePath = "borders" | "thoroughfare-collector" | "neither";
/** One street a receiving school's new walkers cross that their walk to the old campus didn't. */
export interface StreetRequest {
  id: string;
  nbr: number;
  key: string;
  name: string;
  zone: string;
  points: number;
  /** Share of the area now zoned to this school (from the closed zone) whose walk newly crosses it. */
  share: number;
  pedDangerous: boolean;
  highInjury: boolean;
  pedCrashes: number;
  pedDeaths: number;
  segments: { layer: "rail" | "pedHin" | "hin"; id: number }[];
  at: LngLat[];
  lights: { within500: number; medianM: number | null; within250Pct: number; nearest: string | null };
  medianToSchoolM: number;
  streetClass: { type: string | null; owner: string | null; status: string | null; thoroughfareOrCollector: boolean; classifiedPct: number } | null;
  borders: boolean;
  limits: { from: string | null; to: string | null; fromLoc: LngLat | null; toLoc: LngLat | null } | null;
  path: ZonePath;
}
export interface ReceivingSchoolRequests {
  nbr: number;
  name: string;
  address: string;
  loc: LngLat;
  zip: number | null;
  /** "point": no grounds outline was found, so "borders the school" is approximate. */
  grounds: "osm" | "point" | null;
  zone: string;
  points: number;
  shareOfZone: number;
  railNewlyPct: number;
  streets: StreetRequest[];
  smaller: { name: string; points: number }[];
}
export interface ZoneRequests { generatedAt: string; streetContextAt: string | null; minPoints: number; schools: ReceivingSchoolRequests[] }

export interface AppData {
  raw: RawData;
  ds: Dataset;
  meta: Meta;
  totals: Totals;
  zones: ZoneStat[];
  corridors: CorridorStat[];
  shuttles: Shuttles;
  zoneRequests: ZoneRequests;
}

const url = (f: string) => `${import.meta.env.BASE_URL}data/${f}`;
const get = async (f: string) => {
  const r = await fetch(url(f));
  if (!r.ok) throw new Error(`Could not load ${f} (HTTP ${r.status}). Run \`npm run data && npm run compute\`.`);
  return r.json();
};

export async function loadAppData(): Promise<AppData> {
  const keys = ["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"] as const;
  const [layers, meta, zj, corridors, shuttles, signals, railXings, zoneRequests] = await Promise.all([
    Promise.all(keys.map((k) => get(`${k}.geojson`))),
    get("meta.json"),
    get("zones.json"),
    get("corridors.json"),
    get("shuttles.json"),
    get("signals.json"),
    get("rail_crossings.json"),
    get("zone_requests.json"),
  ]);
  const raw = { ...Object.fromEntries(keys.map((k, i) => [k, layers[i]])), signals, rail_crossings: railXings } as unknown as RawData;
  return { raw, ds: buildDataset(raw), meta, totals: zj.totals, zones: zj.zones, corridors, shuttles, zoneRequests };
}

export const DataContext = createContext<AppData | null>(null);
export function useData(): AppData {
  const d = useContext(DataContext);
  if (!d) throw new Error("useData outside DataContext");
  return d;
}

/** The shuttle that picks up at this 2025–26 campus, if the campus closed or moved. */
export function shuttleFrom(d: AppData, campusNbr: number | undefined) {
  return campusNbr === undefined ? undefined : d.shuttles.shuttles.find((s) => s.from.nbr === campusNbr);
}

/** Geometry of the line features named by a hazard's lineIds / a corridor's segments. */
export function segmentFeatures(d: AppData, segs: { layer: "rail" | "pedHin" | "hin"; id: number }[]) {
  return segs.map((s) => (s.layer === "rail" ? d.ds.rail : s.layer === "pedHin" ? d.ds.pedHin : d.ds.hin)[s.id].feature);
}

/** Every segment on the City's lists sharing this road name — the whole corridor, citywide. */
export function roadCorridorTotals(d: AppData, name: string) {
  const key = name.trim().toUpperCase();
  const sum = (lines: typeof d.ds.pedHin) => {
    const hits = lines.filter((l) => (l.props.Full_Name ?? "").trim().toUpperCase() === key);
    return {
      segments: hits.length,
      miles: hits.reduce((a, l) => a + (l.props.MilesLength ?? 0), 0),
      pedCrashes: hits.reduce((a, l) => a + (l.props.ped_crash_count ?? 0), 0),
      pedDeaths: hits.reduce((a, l) => a + (l.props.ped_death_count ?? 0), 0),
    };
  };
  const a = sum(d.ds.pedHin), b = sum(d.ds.hin);
  // On a crash tie (often 0 = 0 for a road on only one list), take the list that actually has the road.
  if (a.pedCrashes !== b.pedCrashes) return a.pedCrashes > b.pedCrashes ? a : b;
  return a.segments >= b.segments ? a : b;
}
