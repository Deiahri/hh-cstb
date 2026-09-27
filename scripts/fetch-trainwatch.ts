// Pulls the City of Houston's Train Watch sensor list (houstontx.gov/trainwatch) into public/data/trainwatch.json and
// ranks every rail crossing the closed zones' walks use by whether a sensor watches it: public/data/sensor_gaps.json.
//
//   npm run trainwatch            # pull the sensor list, then rank
//   npm run trainwatch -- --offline   # rank against the trainwatch.json already in public/data
//
// The walks are the same ~110 m grid compute.ts samples (scripts/grid.ts): each point's walk to its 2025–26 campus
// (the closure shuttle's pickup) and to its 2026–27 school. For each rail crossing on a walk, planWalk's choice
// (the nearest public crossing of that track, controlFor) is the crossing the family is told to use.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type RawData, buildDataset } from "../src/lib/analyze";
import { SHOW_FAR_M, type RailXing, controlFor, railKind, railLabel } from "../src/lib/crossings";
import { haversine } from "../src/lib/geo";
import { TRAIN_WATCH_LAYER, TRAIN_WATCH_PAGE, type TrainWatchSnapshot, type TwSensor, canBlock, sensorForHazard } from "../src/lib/live";
import { SPACING_M, forEachSample } from "./grid";

const dataDir = join(import.meta.dirname, "..", "public", "data");
const read = (f: string) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));
const offline = process.argv.includes("--offline");

let snap: TrainWatchSnapshot;
if (offline) {
  snap = read("trainwatch.json");
  console.log(`Offline: ${snap.sensors.length} sensors from trainwatch.json (${snap.fetchedAt}).`);
} else {
  const q = new URLSearchParams({ where: "1=1", outFields: "code,street,sensorType", outSR: "4326", returnGeometry: "true", f: "json" });
  const r = await fetch(`${TRAIN_WATCH_LAYER}/query?${q}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Train Watch: HTTP ${r.status}`);
  const json = await r.json();
  if (json.error) throw new Error(`Train Watch: ${json.error.message}`);
  const sensors: TwSensor[] = (json.features as any[])
    .filter((f) => f.attributes?.code && f.geometry)
    .map((f) => ({ id: String(f.attributes.code), street: String(f.attributes.street ?? ""), sensorType: String(f.attributes.sensorType ?? ""), loc: [f.geometry.x, f.geometry.y] }));
  snap = { fetchedAt: new Date().toISOString(), source: TRAIN_WATCH_LAYER, sensors };
  writeFileSync(join(dataDir, "trainwatch.json"), JSON.stringify(snap));
  console.log(`Train Watch: ${sensors.length} sensors → trainwatch.json`);
}

const raw: RawData = {
  schools_old: read("schools_old.geojson"), schools_new: read("schools_new.geojson"),
  zones_old: read("zones_old.geojson"), zones_new: read("zones_new.geojson"),
  rail: read("rail.geojson"), ped_hin: read("ped_hin.geojson"), hin: read("hin.geojson"),
  signals: read("signals.json"), rail_crossings: read("rail_crossings.json"),
};
const ds = buildDataset(raw);
const sensors = new Map(snap.sensors.map((s) => [s.id, s]));
const xingById = new Map<string, RailXing>(ds.railXings.map((x) => [x.id, x]));

interface Acc {
  xing: RailXing;
  /** Sample points whose walk is told to cross here (the nearest public crossing of the track, within SHOW_FAR_M). */
  points: number; pickup: number; school: number;
  zones: Set<string>; receiving: Set<string>;
}
const acc = new Map<string, Acc>();
let railPoints = 0, railSteps = 0, stepsWithSensor = 0, stepsToldToUseSensor = 0, points = 0;
const pointsWithSensor = new Set<string>();

forEachSample(ds, (zone, pt, r) => {
  points++;
  let anyRail = false;
  const walks = [["pickup", r.old], ["school", r.now]] as const;
  for (const [which, route] of walks) {
    for (const h of route.hazards) {
      if (h.kind !== "rail") continue;
      anyRail = true; railSteps++;
      if (sensorForHazard(h, ds, sensors)) { stepsWithSensor++; pointsWithSensor.add(pt.join()); }
      const c = controlFor(h, ds);
      if (!c || c.kind !== "rail" || c.d > SHOW_FAR_M) continue;
      if (sensors.has(c.xing.id)) stepsToldToUseSensor++;
      let a = acc.get(c.xing.id);
      if (!a) acc.set(c.xing.id, (a = { xing: c.xing, points: 0, pickup: 0, school: 0, zones: new Set(), receiving: new Set() }));
      a.points++; a[which]++;
      a.zones.add(zone.props.Campus_Short_Name);
      if (which === "school") a.receiving.add(route.school.name);
    }
  }
  if (anyRail) railPoints++;
});

const rows = [...acc.values()].map((a) => ({
  id: a.xing.id,
  label: railLabel(a.xing),
  railroad: a.xing.railroad,
  kind: railKind(a.xing),
  /** A train can stop across it (street at grade). Underpasses and bridges can't be blocked, so they need no sensor. */
  canBlock: canBlock(a.xing),
  monitored: sensors.has(a.xing.id),
  points: a.points, pickup: a.pickup, school: a.school,
  zones: [...a.zones].sort(), receiving: [...a.receiving].sort(),
  loc: a.xing.loc,
}));
// Sensors first, then the at-grade crossings with no sensor by how many walks use them: the list for the next sensors.
rows.sort((x, y) => +y.monitored - +x.monitored || +y.canBlock - +x.canBlock || y.points - x.points);

// Sensors on the tracks the walks cross but not the crossing the walk is told to use (a crossing up the line).
const nearby = snap.sensors.filter((s) => !acc.has(s.id) && rows.some((r) => haversine(r.loc, s.loc) <= SHOW_FAR_M))
  .map((s) => ({ id: s.id, street: s.street, xing: xingById.get(s.id)?.street ?? null }));

const out = {
  generatedAt: new Date().toISOString(),
  trainWatchAt: snap.fetchedAt,
  source: { label: "Train Watch, City of Houston", page: TRAIN_WATCH_PAGE, layer: TRAIN_WATCH_LAYER },
  method:
    `~${SPACING_M} m grid over the closed zones (scripts/grid.ts). For each rail crossing on a point's walk to its 2025–26 ` +
    `campus and to its 2026–27 school, the public crossing the walk plan names (nearest on that track, within ` +
    `${SHOW_FAR_M} m). Counts are sample points, not households.`,
  totals: {
    points, railPoints, railSteps, stepsWithSensor, stepsToldToUseSensor,
    pointsWithSensor: pointsWithSensor.size,
    crossingsUsed: rows.length,
    atGradeUsed: rows.filter((r) => r.canBlock).length,
    monitoredUsed: rows.filter((r) => r.monitored).length,
    sensorsCitywide: snap.sensors.length,
  },
  crossings: rows,
  nearbySensors: nearby,
};
writeFileSync(join(dataDir, "sensor_gaps.json"), JSON.stringify(out, null, 1));

const metaPath = join(dataDir, "meta.json");
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
meta.trainwatch = {
  label: "Train Watch rail-crossing sensors (City of Houston)",
  url: TRAIN_WATCH_PAGE, count: snap.sensors.length, lastEditDate: null, fetchedAt: snap.fetchedAt,
  readOn: new Date(snap.fetchedAt).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }),
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2));

const t = out.totals;
console.log(
  `${t.crossingsUsed} public rail crossings on the walks (${t.atGradeUsed} at street level); ${t.monitoredUsed} have a Train Watch sensor.\n` +
  `${t.pointsWithSensor} of ${t.railPoints} points with a rail crossing have a sensor on that track within ${SHOW_FAR_M} m.\n` +
  `Top unmonitored: ${rows.filter((r) => !r.monitored && r.canBlock).slice(0, 6).map((r) => `${r.label} (${r.points})`).join(", ")}`,
);
