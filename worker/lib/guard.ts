// Checks run on every request and every answer, in code rather than left to the prompt (docs/ai-assistant/build-notes.md).
// Pure functions, so `npm test` covers them without a key or a network.
import { AI_MODES, type AiLang, type AiRequest, LIMITS } from "../../src/lib/ai/types";

// ---- Copy rules 2 and 4 (src/lib/i18n.ts): never "safe", never "qualifies" ----------------------------------------

const FORBIDDEN: Record<AiLang, RegExp[]> = {
  en: [/\b(un)?safe(ly|ty|r|st)?\b/gi, /\bqualif(y|ies|ied|ying|ication|ications)\b/gi],
  es: [/\b(in)?segur[oa]s?\b/gi, /\bseguridad\b/gi, /\bcalific\w*/gi],
};

/** The forbidden words in `text`, lowercased. Checks both languages, because a Spanish page can quote English. */
export function forbiddenWords(text: string): string[] {
  const hits = new Set<string>();
  for (const re of [...FORBIDDEN.en, ...FORBIDDEN.es]) for (const m of text.matchAll(re)) hits.add(m[0].toLowerCase());
  return [...hits];
}

// ---- Reading level: about a 6th-grade target, so flag anything past 8th --------------------------------------------

const words = (text: string) => text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
const sentences = (text: string) => Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length);

function syllablesEn(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length);
}
const syllablesEs = (word: string) => Math.max(1, (word.toLowerCase().match(/[aeiouáéíóúü]+/g) ?? []).length);

/** Flesch–Kincaid grade level (English). */
export function gradeEn(text: string): number {
  const ws = words(text);
  if (!ws.length) return 0;
  const syl = ws.reduce((a, w) => a + syllablesEn(w), 0);
  return 0.39 * (ws.length / sentences(text)) + 11.8 * (syl / ws.length) - 15.59;
}

/** Fernández-Huerta ease (Spanish): higher is easier; 70+ reads as "fairly easy", about 6th–7th grade. */
export function easeEs(text: string): number {
  const ws = words(text);
  if (!ws.length) return 100;
  const syl = ws.reduce((a, w) => a + syllablesEs(w), 0);
  return 206.84 - 0.6 * ((syl / ws.length) * 100) - 1.02 * ((sentences(text) / ws.length) * 100);
}

/** Too hard for the family pages? Very short answers are left alone: the formulas are noise under ~30 words. */
export function tooHard(text: string, lang: AiLang): boolean {
  if (words(text).length < 30) return false;
  return lang === "es" ? easeEs(text) < 60 : gradeEn(text) > 8;
}

// ---- Staff answers cite the rows behind their numbers ---------------------------------------------------------------

/** Every [bracketed id] in an answer. */
export const citations = (text: string) => [...text.matchAll(/\[([^\]\n]{1,80})\]/g)].map((m) => m[1].trim());

/** Cited ids that aren't in the data. */
export const unknownCitations = (text: string, known: Set<string>) => citations(text).filter((id) => !known.has(id));

/** Drop citations that point at nothing, so a made-up id never reaches staff looking like a source. */
export const stripUnknownCitations = (text: string, known: Set<string>) =>
  text.replace(/\s?\[([^\]\n]{1,80})\]/g, (all, id: string) => (known.has(id.trim()) ? all : ""));

// ---- Requests -------------------------------------------------------------------------------------------------------

/** Check a request body; returns the request, or the reason it's refused. Nothing in it is logged either way. */
export function validateRequest(body: unknown): { ok: true; req: AiRequest } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "body" };
  const b = body as Record<string, unknown>;
  if (!AI_MODES.includes(b.mode as never)) return { ok: false, reason: "mode" };
  if (b.lang !== "en" && b.lang !== "es") return { ok: false, reason: "lang" };
  const msgs = b.messages;
  if (!Array.isArray(msgs) || msgs.length === 0 || msgs.length > LIMITS.maxTurns) return { ok: false, reason: "messages" };
  for (const [i, m] of msgs.entries()) {
    if (!m || typeof m !== "object") return { ok: false, reason: "messages" };
    const { role, text } = m as Record<string, unknown>;
    // Turns alternate, starting and ending with the person.
    if (role !== (i % 2 === 0 ? "user" : "assistant")) return { ok: false, reason: "roles" };
    if (typeof text !== "string" || !text.trim() || text.length > LIMITS.maxMessageChars) return { ok: false, reason: "text" };
  }
  if (msgs.length % 2 === 0) return { ok: false, reason: "roles" };
  if (b.mode === "explain" || b.mode === "walkway") {
    if (!b.context || typeof b.context !== "object") return { ok: false, reason: "context" };
    const ctx = JSON.stringify(b.context);
    if (ctx.length > LIMITS.maxContextChars) return { ok: false, reason: "context" };
    // The page sends no coordinates. Anything that looks like a Houston latitude or longitude is refused, not forwarded.
    if (/\b29\.\d{4,}|-9[45]\.\d{4,}/.test(ctx)) return { ok: false, reason: "context" };
  }
  if (b.mode === "narrative" && !Number.isInteger(b.nbr)) return { ok: false, reason: "nbr" };
  return { ok: true, req: b as unknown as AiRequest };
}
