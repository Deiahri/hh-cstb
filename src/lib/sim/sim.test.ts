// The live parsing, the bell-time math, and a full simulated morning with the dispatch agent, on the repo's own data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildDataset } from "../analyze";
import { bellWindow, diffPoll, parseTrainWatch, parseTwTime, summarizeLog, type Blockage } from "../live";
import { forbiddenWords } from "../../../server/lib/guard";
import { logText, newAgent, parseEstimate, runAgent } from "./agent";
import { SCHEDULE, at, demoScenario, makeBuses, startWorld, step } from "./model";

const dir = join(import.meta.dirname, "..", "..", "..", "public", "data");
const r = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const ds = buildDataset({
  schools_old: r("schools_old.geojson"), schools_new: r("schools_new.geojson"), zones_old: r("zones_old.geojson"), zones_new: r("zones_new.geojson"),
  rail: r("rail.geojson"), ped_hin: r("ped_hin.geojson"), hin: r("hin.geojson"), signals: r("signals.json"), rail_crossings: r("rail_crossings.json"),
});
const shuttles = r("shuttles.json").shuttles;

test("Train Watch time strings are UTC, month 1-based, parts optional", () => {
  assert.equal(parseTwTime("[2026,9,27,19,24,59]"), Date.UTC(2026, 8, 27, 19, 24, 59));
  assert.equal(parseTwTime("[2026,9,27,17,30]"), Date.UTC(2026, 8, 27, 17, 30));
  assert.equal(parseTwTime("nope"), null);
});

test("a Train Watch response parses; blocked rows carry start and estimate", () => {
  const s = parseTrainWatch({
    features: [
      { attributes: { code: "859523F", street: "LOCKWOOD STREET", crossingStatus: "blocked", startTime: 1790537281000, timeToClear: "7 MIN", sensorStatus: "DOWN", timeUpdated: "[2026,9,27,19,28,2]" }, geometry: { x: -95.33, y: 29.74 } },
      { attributes: { code: "758739G", street: "CAVALCADE STREET", crossingStatus: "clear", startTime: null }, geometry: { x: -95.34, y: 29.80 } },
      { attributes: {}, geometry: null },
    ],
  });
  assert.equal(s.length, 2);
  assert.deepEqual([s[0].blocked, s[0].timeToClear, s[0].startMs], [true, "7 MIN", 1790537281000]);
  assert.deepEqual([s[1].blocked, s[1].startMs], [false, null]);
  assert.deepEqual(parseTrainWatch({ error: {} }), []);
});

test("bell windows are Houston weekday mornings and afternoons", () => {
  // Mon 2026-09-28 7:30 am CDT = 12:30 UTC; 11 am is outside; Sat is never.
  assert.equal(bellWindow(Date.UTC(2026, 8, 28, 12, 30)), "am");
  assert.equal(bellWindow(Date.UTC(2026, 8, 28, 16, 0)), null);
  assert.equal(bellWindow(Date.UTC(2026, 8, 28, 20, 0)), "pm");
  assert.equal(bellWindow(Date.UTC(2026, 8, 26, 12, 30)), null);
});

test("polls become blockages, and the log rolls up by bell window", () => {
  const open = new Map<string, Blockage>();
  const watch = new Set(["X1"]);
  const t0 = Date.UTC(2026, 8, 28, 12, 20); // 7:20 am CDT, Monday
  const st = (blocked: boolean) => [{ id: "X1", street: "TEST ST", loc: [0, 0] as [number, number], blocked, sensorStatus: "UP", startMs: blocked ? t0 : null, timeToClear: null, updatedMs: null }];
  assert.deepEqual(diffPoll(open, st(true), t0, watch), []);
  const done = diffPoll(open, st(false), t0 + 11 * 60_000, watch);
  assert.equal(done.length, 1);
  const h = summarizeLog(done, [{ pollMs: t0 }], [{ id: "X1", street: "TEST ST", sensorType: "V", loc: [0, 0] }]);
  assert.deepEqual([h[0].windowsWatched, h[0].windowsBlocked, h[0].medianMin], [1, 1, 11]);
});

test("every bus gets a route that uses road crossings only", () => {
  const buses = makeBuses(shuttles, ds);
  assert.ok(buses.length >= 12);
  for (const b of buses) for (const c of b.route.crossings) assert.ok(!/ped/i.test(c.xing.purpose), `${b.label} uses ${c.label}`);
});

test("the demo morning: a reroute at Pleasantville Dr, a stall, a missed tap-off, a no-show, a manual tap", () => {
  const buses = makeBuses(shuttles, ds);
  const sc = demoScenario(buses);
  const w = startWorld(buses, sc.blockages, sc.stalls);
  const ag = newAgent();
  while (w.t < SCHEDULE.end) runAgent(ag, w, step(w, 5), ds);
  const kinds = (k: string) => ag.log.filter((e) => e.kind === k);
  assert.ok([...w.state.values()].every((s) => s.phase === "done"), "every bus finishes");
  assert.equal(kinds("reroute").length, 1);
  assert.match(kinds("reroute")[0].text, /Pleasantville Dr is blocked/);
  assert.ok(kinds("stop").some((e) => /between stops/.test(e.text)));
  assert.ok(kinds("late").length >= 1);
  assert.ok(kinds("reconcile").some((e) => /tapped on and not off/.test(e.text)));
  assert.equal(kinds("roster").length, 1);
  assert.ok(kinds("depart").some((e) => /entered by the driver/.test(e.text)));
  // The rerouted bus avoided the train and wasn't late for it.
  const b6 = w.state.get(buses.find((b) => /^Port Houston/.test(b.label))!.id)!;
  assert.ok(b6.arrivedAt! - b6.plannedArrival < 180);
  // The log goes to the model as is, so it has to pass the same word checks.
  assert.deepEqual(forbiddenWords(logText(ag)), []);
  assert.ok(!/29\.\d{4,}|-9[45]\.\d{4,}/.test(logText(ag)), "no coordinates in the log");
});

test("with no demo events, nothing is rerouted and nobody is late", () => {
  const buses = makeBuses(shuttles, ds);
  const w = startWorld(buses);
  const ag = newAgent();
  while (w.t < at(8, 0)) runAgent(ag, w, step(w, 5), ds);
  assert.equal(ag.reroutes, 0);
  assert.equal(ag.log.filter((e) => e.kind === "late").length, 0);
});

test("the City's estimate parses", () => {
  assert.equal(parseEstimate("7 MIN"), 420);
  assert.equal(parseEstimate(null), null);
});
