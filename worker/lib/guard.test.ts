import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { citations, easeEs, forbiddenWords, gradeEn, stripUnknownCitations, tooHard, unknownCitations, validateRequest } from "./guard";
import { mockReply } from "./mock";
import { staffData } from "./prompts";

test("forbidden words: the copy rules, in both languages", () => {
  assert.deepEqual(forbiddenWords("Is it safe? It's unsafe. Safety first."), ["safe", "unsafe", "safety"]);
  assert.deepEqual(forbiddenWords("Your family qualifies. You may qualify."), ["qualifies", "qualify"]);
  assert.deepEqual(forbiddenWords("No es seguro. La calle es insegura. Su hijo califica."), ["seguro", "insegura", "califica"]);
  assert.deepEqual(forbiddenWords("Cross at the traffic light at Liberty & Altoona."), []);
  // Words that merely contain the letters pass.
  assert.deepEqual(forbiddenWords("A safeguard. Unsafely? The seguimiento."), ["unsafely"]);
});

test("reading level: short answers pass, dense ones don't", () => {
  const easy = "Your child's walk crosses one busy road. Cross at the light. It is a short way to the right. Then walk on to the school. Ask the school where the bus stops. Call HISD if you need help.";
  const hard =
    "Notwithstanding the aforementioned considerations, transportation eligibility determinations necessitate comprehensive evaluation of " +
    "infrastructural characteristics, including pedestrian accommodations, signalization configurations, and institutional administrative procedures, " +
    "consequently precluding definitive characterization of individualized circumstances. Furthermore, jurisdictional " +
    "responsibilities regarding intersection modifications remain distributed among multiple governmental organizations.";
  assert.ok(gradeEn(easy) < 8, `easy grade ${gradeEn(easy)}`);
  assert.ok(tooHard(hard, "en"), `hard grade ${gradeEn(hard)}`);
  assert.equal(tooHard("Short answer.", "en"), false);
  const facil = "El camino de su hijo cruza una calle. Crucen en el semáforo. Está a la derecha. Luego sigan a la escuela. Pregunte en la escuela dónde para el autobús. Llame a HISD si necesita ayuda.";
  assert.ok(easeEs(facil) >= 60, `ease ${easeEs(facil)}`);
});

test("citations: known ids pass, made-up ids are found and stripped", () => {
  const known = new Set(["road:LIBERTY RD", "203|road:WESTOVER ST"]);
  const text = "Liberty Rd has 12 crashes [road:LIBERTY RD]. Westover [203|road:WESTOVER ST] and Main [road:MAIN ST].";
  assert.deepEqual(citations(text), ["road:LIBERTY RD", "203|road:WESTOVER ST", "road:MAIN ST"]);
  assert.deepEqual(unknownCitations(text, known), ["road:MAIN ST"]);
  assert.equal(stripUnknownCitations(text, known), "Liberty Rd has 12 crashes [road:LIBERTY RD]. Westover [203|road:WESTOVER ST] and Main.");
});

const ctx = { headline: "x", walkToSchool: { to: "A", miles: 1, crossings: [] } };
const req = (over: Record<string, unknown> = {}) => ({ mode: "explain", lang: "en", context: ctx, messages: [{ role: "user", text: "Why?" }], ...over });

test("requests: shape, turns, sizes", () => {
  assert.equal(validateRequest(req()).ok, true);
  assert.equal(validateRequest(req({ mode: "anything" })).ok, false);
  assert.equal(validateRequest(req({ lang: "fr" })).ok, false);
  assert.equal(validateRequest(req({ messages: [] })).ok, false);
  assert.equal(validateRequest(req({ messages: [{ role: "assistant", text: "hi" }] })).ok, false);
  assert.equal(validateRequest(req({ messages: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] })).ok, false);
  assert.equal(validateRequest(req({ messages: [{ role: "user", text: "x".repeat(1501) }] })).ok, false);
  assert.equal(validateRequest(req({ messages: Array.from({ length: 13 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "x" })) })).ok, false);
  assert.equal(validateRequest(req({ context: undefined })).ok, false);
  assert.equal(validateRequest(req({ context: { pad: "x".repeat(8001) } })).ok, false);
  assert.equal(validateRequest({ mode: "staff", lang: "en", messages: [{ role: "user", text: "Which?" }] }).ok, true);
  assert.equal(validateRequest({ mode: "narrative", lang: "en", messages: [{ role: "user", text: "Draft" }] }).ok, false);
});

test("requests: anything that looks like home coordinates is refused", () => {
  assert.equal(validateRequest(req({ context: { ...ctx, home: [-95.33412, 29.78123] } })).ok, false);
  assert.equal(validateRequest(req({ context: { ...ctx, note: "29.7812, -95.3341" } })).ok, false);
});

test("staff data: geometry dropped, every row id known, fits in one prompt", () => {
  const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, "utf8"));
  const zr = read("zone_requests.json");
  const { text, known, schools } = staffData({ corridors: read("corridors.json"), zoneRequests: zr, zones: read("zones.json") });
  assert.ok(known.has("road:LIBERTY RD"));
  for (const s of zr.schools) {
    assert.ok(known.has(`school:${s.nbr}`));
    assert.equal(schools.get(s.nbr), s.name);
    for (const st of s.streets) assert.ok(known.has(st.id));
  }
  assert.ok(!text.includes('"rings"') && !text.includes('"segments"'));
  assert.ok(text.length < 110_000, `staff data is ${text.length} chars`);
});

test("mock replies pass the same checks", () => {
  assert.deepEqual(forbiddenWords(mockReply("walkway", "es", undefined, "no hay banqueta en Lyons y pasan camiones")), []);
  assert.match(mockReply("walkway", "en", undefined, "bad"), /^ASK: /);
  assert.match(mockReply("walkway", "en", undefined, "there is no sidewalk on Lyons"), /^DRAFT: /);
});
