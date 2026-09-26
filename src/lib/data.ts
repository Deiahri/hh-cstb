// Loads the snapshot written by scripts/fetch-data.ts and scripts/compute.ts.
import { createContext, useContext } from "react";
import { type Dataset, type RawData, buildDataset } from "./analyze";
import type { LngLat } from "./geo";

export interface LayerMeta { label: string; url: string; count: number; lastEditDate: string | null }
export type Meta = { fetchedAt: string; campus_grounds?: LayerMeta } & Record<keyof RawData, LayerMeta>;

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

export interface AppData {
  raw: RawData;
  ds: Dataset;
  meta: Meta;
  totals: Totals;
  zones: ZoneStat[];
  corridors: CorridorStat[];
  shuttles: Shuttles;
}

const url = (f: string) => `${import.meta.env.BASE_URL}data/${f}`;
const get = async (f: string) => {
  const r = await fetch(url(f));
  if (!r.ok) throw new Error(`Could not load ${f} (HTTP ${r.status}). Run \`npm run data && npm run compute\`.`);
  return r.json();
};

export async function loadAppData(): Promise<AppData> {
  const keys = ["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"] as const;
  const [layers, meta, zj, corridors, shuttles] = await Promise.all([
    Promise.all(keys.map((k) => get(`${k}.geojson`))),
    get("meta.json"),
    get("zones.json"),
    get("corridors.json"),
    get("shuttles.json"),
  ]);
  const raw = Object.fromEntries(keys.map((k, i) => [k, layers[i]])) as unknown as RawData;
  return { raw, ds: buildDataset(raw), meta, totals: zj.totals, zones: zj.zones, corridors, shuttles };
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
