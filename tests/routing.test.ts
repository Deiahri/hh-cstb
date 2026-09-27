import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { analyzeAddress, buildDataset, type RawData, type Dataset, type RoadProps } from "../src/lib/analyze";
import { indexLines, haversine, type LngLat } from "../src/lib/geo";
import { createWalkingClient, parseWalkingRoute, routeKey } from "../src/lib/routing";
import { hazardsOnPath } from "../src/lib/route-hazards";
import { walkingFitPoints, withWalkingRoutes } from "../src/lib/useWalkingAddress";
import { planWalk } from "../src/lib/crossings";

const from: LngLat = [-95.397052, 29.684561], to: LngLat = [-95.396, 29.686];
const coordinates: LngLat[] = [from, [-95.397052, 29.686], to];
const distanceM = haversine(coordinates[0], coordinates[1]) + haversine(coordinates[1], coordinates[2]);
const response = () => Response.json({ coordinates, distanceM });
const signal = () => new AbortController().signal;

test("preserves longitude/latitude, bends and unverified endpoint gaps", () => {
  const shifted: LngLat = [from[0] + 0.0001, from[1]];
  const route = parseWalkingRoute({ coordinates, distanceM }, shifted, to);
  assert.deepEqual(route.coordinates, coordinates);
  assert.ok(route.startGapM > 5 && route.startGapM < 15);
  assert.equal(route.endGapM, 0);
  for (const v of [null, {}, { coordinates: [], distanceM }, { coordinates: coordinates.map(([x,y]) => [y,x]), distanceM },
    { coordinates, distanceM: NaN }, { coordinates, distanceM: 9000 }, { coordinates: [[0,0], [1,1]], distanceM }]) {
    assert.throws(() => parseWalkingRoute(v, from, to));
  }
});

test("client caches successes, expires them and sends only coordinates", async () => {
  let calls = 0, clock = 0;
  const client = createWalkingClient(async (_url, init) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { coordinates: [from, to] });
    return response();
  }, () => clock);
  await client(from, to, signal()); await client(from, to, signal());
  assert.equal(calls, 1);
  clock = 300001;
  await client(from, to, signal());
  assert.equal(calls, 2);
});

test("failure is not cached and cancellation cannot publish/cache stale success", async () => {
  let calls = 0;
  const controller = new AbortController();
  const client = createWalkingClient(async () => {
    calls++;
    if (calls === 1) return new Response("unavailable", { status: 503 });
    if (calls === 2) controller.abort(); // provider completed after user changed address
    return response();
  });
  await assert.rejects(client(from, to, signal()));
  await assert.rejects(client(from, to, controller.signal));
  await client(from, to, signal());
  assert.equal(calls, 3);
});

test("client times out a stalled provider", async () => {
  const client = createWalkingClient(async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
  }), Date.now, 5);
  const keepAlive = setTimeout(() => {}, 100);
  try { await assert.rejects(client(from, to, signal()), /timeout|aborted/i); }
  finally { clearTimeout(keepAlive); }
});

function road(name: string, points: LngLat[], count = 3) {
  return { type: "Feature" as const, geometry: { type: "LineString", coordinates: points },
    properties: { Full_Name: name, ped_crash_count: count, ped_death_count: 1, total_crash_count: 5, MilesLength: 1 } satisfies RoadProps };
}
function dataset(features: ReturnType<typeof road>[]): Dataset {
  return { zonesOld: [], zonesNew: [], schoolsOld: new Map(), schoolsNew: new Map(), closedIds: new Set(),
    signals: [], railXings: [], rail: [], pedHin: indexLines({ type: "FeatureCollection", features }),
    hin: indexLines({ type: "FeatureCollection", features }) };
}

test("hazards follow the walked bend, include touching vertices and deduplicate feature/layer counts", () => {
  const ds = dataset([road("BEND", [[1,-1],[1,1]]), road("STRAIGHT ONLY", [[0.9,0.8],[1.1,1.2]])]);
  const path: LngLat[] = [[0,0], [1,0], [2,0], [2,2]];
  const hs = hazardsOnPath(path, ds);
  assert.deepEqual(hs.map(h => h.key), ["road:BEND"]);
  assert.equal(hs[0].pedCrashes, 3); // not doubled at vertex or across HIN/ped-HIN
  assert.equal(hs[0].lineIds.length, 2);
  assert.deepEqual(hs[0].at, [1,0]);
});

test("first intersections are sorted along the walk, not by distance from home or dataset order", () => {
  const ds = dataset([road("LATE", [[0.5,1.5],[0.5,2.5]]), road("EARLY", [[2.5,-1],[2.5,1]])]);
  assert.deepEqual(hazardsOnPath([[0,0],[3,0],[3,2],[0,2]], ds).map(h => h.key), ["road:EARLY", "road:LATE"]);
  assert.deepEqual(hazardsOnPath([[0,0],[0,0]], ds), []);
});

test("actual supplied and second addresses keep original schools, distance, snapshots and fallback", () => {
  const raw = Object.fromEntries(["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"]
    .map(k => [k, JSON.parse(readFileSync(new URL(`../public/data/${k}.geojson`, import.meta.url), "utf8"))])) as unknown as RawData;
  const ds = buildDataset(raw);
  const before = JSON.stringify(raw);
  for (const p of [from, [-95.3,29.77] as LngLat]) {
    const base = analyzeAddress(p, ds);
    assert.ok(base.now, "fixture inside a school zone");
    const copy = JSON.stringify(base);
    const fallback = withWalkingRoutes(base, {}, ds);
    assert.equal(fallback.now?.routing?.status, "loading");
    assert.deepEqual(fallback.now?.hazards, base.now.hazards);
    const school = base.now.school.loc;
    const path: LngLat[] = [p, [p[0], school[1]], school]; // synthetic geometry, NOT live routing evidence
    const route = parseWalkingRoute({ coordinates: path, distanceM: haversine(path[0],path[1])+haversine(path[1],path[2]) }, p, school);
    const result = withWalkingRoutes(base, { [routeKey(p, school)]: { status: "ready", route } }, ds);
    assert.equal(result.now?.distance, base.now.distance);
    assert.deepEqual(result.now?.school, base.now.school);
    assert.deepEqual(result.now?.hazards, hazardsOnPath(path, ds));
    for (const vertex of path) assert.ok(walkingFitPoints(result).some(p => p[0] === vertex[0] && p[1] === vertex[1]), "bounds include every route vertex");
    assert.equal(planWalk(p, result.now!, ds).path, null, "never draw unverified control connectors");
    assert.ok(planWalk(p, result.now!, ds).steps.every(s => s.contextOnly && s.detourM === null));
    const unavailable = withWalkingRoutes(base, { [routeKey(p, school)]: { status: "unavailable" } }, ds);
    assert.deepEqual(unavailable.now?.hazards, base.now.hazards);
    assert.deepEqual(unavailable.newlyCrossed, [], "do not compare unmatched routing methods");
    assert.equal(JSON.stringify(base), copy);
  }
  assert.equal(JSON.stringify(raw), before);
});
