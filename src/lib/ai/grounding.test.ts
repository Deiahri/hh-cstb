import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildDataset, type RawData } from "../analyze";
import type { AppData } from "../data";
import { analyzeWalk } from "../walk";
import { walkGrounding } from "./grounding";
import { LIMITS } from "./types";
import { forbiddenWords, validateRequest } from "../../../server/lib/guard";

// The same files loadAppData() fetches, read from disk.
const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, "utf8"));
const keys = ["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"] as const;
const raw = { ...Object.fromEntries(keys.map((k) => [k, read(`${k}.geojson`)])), signals: read("signals.json"), rail_crossings: read("rail_crossings.json") } as unknown as RawData;
const zj = read("zones.json");
const d: AppData = {
  raw, ds: buildDataset(raw), meta: read("meta.json"), totals: zj.totals, zones: zj.zones,
  corridors: read("corridors.json"), shuttles: read("shuttles.json"), zoneRequests: read("zone_requests.json"),
  trainwatch: null, sensorGaps: null, liveHistory: null,
};

for (const z of d.zones.filter((z) => z.demoPoint)) {
  test(`grounding for a home in the old ${z.name} zone`, () => {
    const addr = "1800 Example St, Houston, TX 77026";
    const w = analyzeWalk(d, z.demoPoint!, { addr, prek: true });
    for (const lang of ["en", "es"] as const) {
      const g = walkGrounding(d, w, lang);
      assert.ok(g, "a closed-zone home has a result");
      const s = JSON.stringify(g);
      // No address, no coordinates: nothing that locates the home leaves the browser.
      assert.ok(!s.includes("Example St") && !s.includes("77026"), "no address");
      assert.ok(!/\b29\.\d{4,}|-9[45]\.\d{4,}/.test(s), "no coordinates");
      assert.ok(s.length < LIMITS.maxContextChars, `context is ${s.length} chars`);
      // The page's own copy already follows the rules, so its grounding must too.
      assert.deepEqual(forbiddenWords(s), [], "copy rules");
      assert.equal(g.closedZone, true);
      assert.equal(g.walkToSchool.crossings.length, w.nowPlan?.steps.length ?? 0);
      assert.ok(validateRequest({ mode: "explain", lang, context: g, messages: [{ role: "user", text: "Why?" }] }).ok, "the proxy accepts it");
    }
  });
}
