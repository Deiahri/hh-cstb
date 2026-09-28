import assert from "node:assert/strict";
import { test } from "node:test";
import { type UiCrossing, problemLine, verdictOf } from "./model";
import { UI } from "./strings";

const lit = { control: { has: true } };
const dark = { control: { has: false } };

test("no crossings is green", () => assert.equal(verdictOf([]), "green"));
test("every crossing has a light or gate nearby: yellow", () => assert.equal(verdictOf([lit, lit]), "yellow"));
test("any crossing with no light or gate nearby: red", () => assert.equal(verdictOf([lit, dark]), "red"));

const road = (has: boolean, ped = true): UiCrossing => ({
  key: "r", kind: "road", name: "Irvington Blvd", ped, pc: 0, pd: 0, at: [0, 0], street: null,
  control: has ? { has, name: "Irvington & Cavalcade", d: 90, dir: "N" } : { has },
});
test("problem line: a road with no light", () =>
  assert.equal(problemLine(road(false), UI.en), "Crosses Irvington Blvd: dangerous for walking, high-injury road, no traffic light within 800 ft."));
test("problem line: a road with a light nearby", () =>
  assert.equal(problemLine(road(true, false), UI.en), "Crosses Irvington Blvd: high-injury road, traffic light 300 ft N."));
test("problem line: gated rail crossing, in Spanish", () =>
  assert.equal(
    problemLine({ ...road(true), kind: "rail", name: "Union Pacific", control: { has: true, d: 60, dir: "E", gates: true } }, UI.es),
    "Cruza las vías de Union Pacific: vías activas, cruce público a 200 pies al este (barreras).",
  ));
