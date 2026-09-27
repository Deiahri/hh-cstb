import assert from "node:assert/strict";
import { test } from "node:test";
import { createWalkRoute } from "../walk";

type LngLat = [number, number];
const coordinates: LngLat[] = [[-95.397052, 29.684561], [-95.396, 29.686]];
const fixture = { features: [{ geometry: { type: "LineString", coordinates }, properties: { summary: { distance: 190 } } }] };

test("no key: says so, and calls nobody", async () => {
  let calls = 0;
  const walk = createWalkRoute({ apiKey: "", fetcher: async () => (calls++, Response.json(fixture)) });
  assert.deepEqual(await walk({ coordinates }), { status: 503, body: { error: "routing_unconfigured" } });
  assert.equal(calls, 0);
});

test("walking profile only, the key stays server-side, successes cache, and the cap applies", async () => {
  let calls = 0;
  const walk = createWalkRoute({
    apiKey: "test-secret",
    perMinute: 1,
    fetcher: (async (url: string, init: RequestInit) => {
      calls++;
      assert.match(url, /\/foot-walking\/geojson$/);
      assert.equal((init.headers as Record<string, string>).Authorization, "test-secret");
      assert.deepEqual(JSON.parse(String(init.body)), { coordinates, radiuses: [200, 200], instructions: false });
      return Response.json(fixture);
    }) as typeof fetch,
  });
  const r = await walk({ coordinates });
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.body).includes("test-secret"));
  assert.deepEqual(r.body, { coordinates, distanceM: 190 });
  assert.equal((await walk({ coordinates })).status, 200);
  assert.equal(calls, 1);
  assert.equal((await walk({ coordinates: [coordinates[0], [-95.39, 29.7]] })).status, 429);
  // Swapped lat/lng, one point, and no body at all are refused before any call.
  for (const bad of [{ coordinates: [[29.68, -95.39], coordinates[1]] }, { coordinates: [coordinates[0]] }, null]) assert.equal((await walk(bad)).status, 400);
});

test("upstream errors, bad geometry and timeouts never become routes", async () => {
  const fetchers = [
    async () => new Response("secret upstream detail", { status: 403 }),
    async () => Response.json({}),
    async () => Response.json({ features: [{ ...fixture.features[0], properties: { summary: { distance: 9000 } } }] }),
    async () => Response.json({ features: [{ ...fixture.features[0], geometry: { type: "LineString", coordinates: [[-95.5, 29.7], [-95.5, 29.701]] } }] }),
    (_url: string, init: RequestInit) => new Promise<Response>((_ok, fail) => init.signal!.addEventListener("abort", () => fail(init.signal!.reason))),
  ];
  // AbortSignal.timeout's timer doesn't hold the process open; this does, until the timeout case settles.
  const alive = setInterval(() => {}, 1000);
  try {
    for (const fetcher of fetchers) {
      const walk = createWalkRoute({ apiKey: "k", fetcher: fetcher as typeof fetch, timeoutMs: 5 });
      assert.deepEqual(await walk({ coordinates }), { status: 502, body: { error: "routing_unavailable" } });
    }
  } finally {
    clearInterval(alive);
  }
});

test("simultaneous requests share one upstream call, and a failure isn't cached", async () => {
  let calls = 0, release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const walk = createWalkRoute({
    apiKey: "k",
    fetcher: (async () => {
      calls++;
      if (calls === 1) {
        await gate;
        return new Response("unavailable", { status: 503 });
      }
      return Response.json(fixture);
    }) as typeof fetch,
  });
  const pending = [walk({ coordinates }), walk({ coordinates })];
  release();
  assert.deepEqual((await Promise.all(pending)).map((r) => r.status), [502, 502]);
  assert.equal(calls, 1);
  assert.equal((await walk({ coordinates })).status, 200);
  assert.equal(calls, 2);
});
