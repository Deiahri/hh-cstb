import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../server/index.mjs";

const coordinates = [[-95.397052,29.684561],[-95.396,29.686]];
const fixture = { features: [{ geometry: { type: "LineString", coordinates }, properties: { summary: { distance: 190 } } }] };
async function run(options, check) {
  const server = createApp(options);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (value = { coordinates }) => fetch(`${base}/api/walk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  try { await check(post, base); } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
test("production server serves built app and reports missing server credentials honestly", async () => {
  await run({ apiKey: "" }, async (post, base) => {
    assert.equal((await post()).status, 503);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<div id="root">/);
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    assert.equal((await (await fetch(`${base}/healthz`)).json()).routingConfigured, false);
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 404);
  });
});
test("walking-only request, secret stays server-side, successes cache and request limits apply", async () => {
  let calls = 0;
  await run({ apiKey: "test-secret", perMinute: 1, fetcher: async (url, init) => {
    calls++;
    assert.match(url, /\/foot-walking\/geojson$/);
    assert.equal(init.headers.Authorization, "test-secret");
    assert.deepEqual(JSON.parse(init.body), { coordinates, radiuses: [200,200], instructions: false });
    return Response.json(fixture);
  } }, async post => {
    const r = await post();
    assert.equal(r.status, 200);
    const body = await r.text(); assert.ok(!body.includes("test-secret"));
    assert.deepEqual(JSON.parse(body), { coordinates, distanceM: 190 });
    assert.equal((await post()).status, 200); assert.equal(calls, 1);
    assert.equal((await post({ coordinates: [coordinates[0],[-95.39,29.7]] })).status, 429);
    assert.equal((await post({ coordinates: [[29.68,-95.39],coordinates[1]] })).status, 400);
  });
});
test("upstream HTTP, invalid geometry and timeout failures never become successful routes", async () => {
  for (const fetcher of [async () => new Response("secret upstream detail", { status: 403 }), async () => Response.json({}),
    async () => Response.json({ features: [{ ...fixture.features[0], properties: { summary: { distance: 9000 } } }] }),
    async () => Response.json({ features: [{ ...fixture.features[0], geometry: { type: "LineString", coordinates: [[-95.5, 29.7], [-95.5, 29.701]] } }] }),
    async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)))]) {
    await run({ apiKey: "test-secret", fetcher, timeoutMs: 5 }, async post => {
      const r = await post(); assert.equal(r.status, 502);
      assert.deepEqual(await r.json(), { error: "routing_unavailable" });
    });
  }
});

test("simultaneous requests share one upstream call and failed responses can be retried", async () => {
  let calls = 0, release;
  const gate = new Promise(r => { release = r; });
  await run({ apiKey: "test-secret", fetcher: async () => {
    calls++;
    if (calls === 1) { await gate; return new Response("unavailable", { status: 503 }); }
    return Response.json(fixture);
  } }, async post => {
    const pending = [post(), post()];
    // Allow both local requests to arrive while the single provider response is pending.
    await new Promise(r => setTimeout(r, 30));
    release();
    assert.deepEqual((await Promise.all(pending)).map(r => r.status), [502, 502]);
    assert.equal(calls, 1);
    assert.equal((await post()).status, 200);
    assert.equal(calls, 2);
  });
});
