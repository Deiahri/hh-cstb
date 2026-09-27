// Walking routes (Murphy Amos's PR #1): the client, the hazards along a route, and what the screens get from it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { analyzeAddress, buildDataset, type Dataset, type RawData, type RoadProps } from "./analyze";
import { planWalk } from "./crossings";
import type { AppData } from "./data";
import { haversine, indexLines, type LngLat } from "./geo";
import { createWalkingClient, parseWalkingRoute, routeKey } from "./routing";
import { hazardsOnPath } from "./route-hazards";
import { toCheck } from "./ui/model";
import { routePending, withWalkingRoutes } from "./useWalkingAddress";
import { analyzeWalk } from "./walk";

const from: LngLat = [-95.397052, 29.684561], to: LngLat = [-95.396, 29.686];
const coordinates: LngLat[] = [from, [-95.397052, 29.686], to];
const distanceM = haversine(coordinates[0], coordinates[1]) + haversine(coordinates[1], coordinates[2]);
const response = () => Response.json({ coordinates, distanceM });
const signal = () => new AbortController().signal;

test("keeps lng/lat order and the bends, measures the unrouted gaps, refuses bad routes", () => {
  const shifted: LngLat = [from[0] + 0.0001, from[1]];
  const route = parseWalkingRoute({ coordinates, distanceM }, shifted, to);
  assert.deepEqual(route.coordinates, coordinates);
  assert.ok(route.startGapM > 5 && route.startGapM < 15);
  assert.equal(route.endGapM, 0);
  for (const v of [null, {}, { coordinates: [], distanceM }, { coordinates: coordinates.map(([x, y]) => [y, x]), distanceM },
    { coordinates, distanceM: NaN }, { coordinates, distanceM: 9000 }, { coordinates: [[0, 0], [1, 1]], distanceM }]) {
    assert.throws(() => parseWalkingRoute(v, from, to));
  }
});

test("client caches successes, expires them, sends only the two points, and peek sees the cache", async () => {
  let calls = 0, clock = 0;
  const client = createWalkingClient(async (_url, init) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { coordinates: [from, to] });
    return response();
  }, () => clock);
  assert.equal(client.peek(from, to), undefined);
  await client(from, to, signal());
  await client(from, to, signal());
  assert.equal(calls, 1);
  assert.equal(client.peek(from, to)?.status, "ready");
  clock = 300001;
  assert.equal(client.peek(from, to), undefined);
  await client(from, to, signal());
  assert.equal(calls, 2);
});

test("a failure is remembered for a minute, then retried; a cancelled request is neither cached nor remembered", async () => {
  let calls = 0, clock = 0;
  const controller = new AbortController();
  const client = createWalkingClient(async () => {
    calls++;
    if (calls === 1) return new Response("unavailable", { status: 503 });
    if (calls === 2) controller.abort(); // the route came back after the family changed the address
    return response();
  }, () => clock);
  await assert.rejects(client(from, to, signal()));
  assert.equal(client.peek(from, to)?.status, "unavailable");
  await assert.rejects(client(from, to, signal()));
  assert.equal(calls, 1, "no second ask within the minute");
  clock = 60001;
  assert.equal(client.peek(from, to), undefined);
  await assert.rejects(client(from, to, controller.signal));
  assert.equal(client.peek(from, to), undefined, "an abort isn't a failure, and its route isn't cached");
  await client(from, to, signal());
  assert.equal(calls, 3);
});

test("client times out a stalled API", async () => {
  const client = createWalkingClient(async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
  }), Date.now, 5);
  const keepAlive = setTimeout(() => {}, 100);
  try {
    await assert.rejects(client(from, to, signal()), /timeout|aborted/i);
  } finally {
    clearTimeout(keepAlive);
  }
});

function road(name: string, points: LngLat[], count = 3) {
  return { type: "Feature" as const, geometry: { type: "LineString", coordinates: points },
    properties: { Full_Name: name, ped_crash_count: count, ped_death_count: 1, total_crash_count: 5, MilesLength: 1 } satisfies RoadProps };
}
function dataset(features: ReturnType<typeof road>[]): Dataset {
  return { zonesOld: [], zonesNew: [], schoolsOld: new Map(), schoolsNew: new Map(), closedIds: new Set(),
    signals: [], railXings: [], rail: [], pedHin: indexLines({ type: "FeatureCollection", features }),
    hin: indexLines({ type: "FeatureCollection", features }) } as unknown as Dataset;
}

test("hazards follow the bend, count a touching vertex, and count each road once", () => {
  const ds = dataset([road("BEND", [[1, -1], [1, 1]]), road("STRAIGHT ONLY", [[0.9, 0.8], [1.1, 1.2]])]);
  const hs = hazardsOnPath([[0, 0], [1, 0], [2, 0], [2, 2]], ds);
  assert.deepEqual(hs.map((h) => h.key), ["road:BEND"]);
  assert.equal(hs[0].pedCrashes, 3); // not doubled at the vertex or across the two City lists
  assert.equal(hs[0].lineIds.length, 2);
  assert.deepEqual(hs[0].at, [1, 0]);
  assert.equal(hs[0].name, "Bend", "named as hazardsOnRoute names roads");
});

test("crossings come in the order the walk meets them", () => {
  const ds = dataset([road("LATE", [[0.5, 1.5], [0.5, 2.5]]), road("EARLY", [[2.5, -1], [2.5, 1]])]);
  assert.deepEqual(hazardsOnPath([[0, 0], [3, 0], [3, 2], [0, 2]], ds).map((h) => h.key), ["road:EARLY", "road:LATE"]);
  assert.deepEqual(hazardsOnPath([[0, 0], [0, 0]], ds), []);
});

// The real data, as grounding.test.ts reads it.
const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, "utf8"));
const keys = ["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"] as const;
const raw = { ...Object.fromEntries(keys.map((k) => [k, read(`${k}.geojson`)])), signals: read("signals.json"), rail_crossings: read("rail_crossings.json") } as unknown as RawData;
const zj = read("zones.json");
const d: AppData = {
  raw, ds: buildDataset(raw), meta: read("meta.json"), totals: zj.totals, zones: zj.zones,
  corridors: read("corridors.json"), shuttles: read("shuttles.json"), zoneRequests: read("zone_requests.json"),
};

test("real addresses: schools and straight-line distance unchanged, routed hazards and distance, straight line as fallback", () => {
  for (const p of [from, [-95.3, 29.77] as LngLat, d.zones.find((z) => z.demoPoint)!.demoPoint!]) {
    const base = analyzeAddress(p, d.ds);
    assert.ok(base.now, "inside a school zone");
    const copy = JSON.stringify(base);
    const waiting = withWalkingRoutes(base, {}, d.ds);
    assert.equal(waiting.now?.routing?.status, "loading");
    assert.ok(routePending(waiting));
    assert.deepEqual(waiting.now?.hazards, base.now.hazards);

    const school = base.now.school.loc;
    const path: LngLat[] = [p, [p[0], school[1]], school]; // synthetic geometry, not a live route
    const route = parseWalkingRoute({ coordinates: path, distanceM: haversine(path[0], path[1]) + haversine(path[1], path[2]) }, p, school);
    const states = { [routeKey(p, school)]: { status: "ready" as const, route } };
    if (base.old) states[routeKey(p, base.old.school.loc)] ??= { status: "unavailable" } as never;
    const routed = withWalkingRoutes(base, states, d.ds);
    assert.ok(!routePending(routed));
    assert.equal(routed.now?.distance, base.now.distance);
    assert.deepEqual(routed.now?.school, base.now.school);
    assert.deepEqual(routed.now?.hazards, hazardsOnPath(path, d.ds));
    assert.equal(planWalk(p, routed.now!, d.ds).path, null, "no made-up path through the lights");
    assert.ok(planWalk(p, routed.now!, d.ds).steps.every((s) => s.contextOnly && s.detourM === null));

    // What /check shows: walking distance and the route's line; the 2-mile rule stays on the straight line.
    const c = toCheck(d, analyzeWalk(d, p, { addr: "x", prek: null, r: routed }))!;
    assert.equal(c.distM, route.distanceM);
    assert.equal(c.lineM, base.now.distance);
    assert.deepEqual(c.path, path);
    assert.equal(c.crossings.length, routed.now!.hazards.length);

    const off = withWalkingRoutes(base, {}, d.ds, () => ({ status: "unavailable" }));
    assert.ok(!routePending(off));
    assert.deepEqual(off.now?.hazards, base.now.hazards);
    assert.deepEqual(off.newlyCrossed, base.newlyCrossed, "no routes: the straight-line comparison stands");
    const offCheck = toCheck(d, analyzeWalk(d, p, { addr: "x", prek: null, r: off }))!;
    assert.equal(offCheck.path, null);
    assert.equal(offCheck.distM, base.now.distance);
    assert.equal(JSON.stringify(base), copy, "the straight-line analysis isn't changed");
  }
});

test("a route that is the straight line finds exactly the straight line's hazards", () => {
  for (const z of d.zones.filter((z) => z.demoPoint)) {
    const base = analyzeAddress(z.demoPoint!, d.ds);
    for (const r of [base.old, base.now]) {
      if (!r) continue;
      const along = hazardsOnPath([base.point, r.school.loc], d.ds);
      const pick = (hs: typeof along) => hs.map((h) => [h.key, h.name, h.pedDangerous, h.highInjury, h.pedCrashes, h.pedDeaths, h.totalCrashes]);
      assert.deepEqual(pick(along), pick(r.hazards), `${z.name} → ${r.school.name}`);
    }
  }
});
