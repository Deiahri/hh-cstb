// POST /api/ai — the one server piece of Walk Check (Cloudflare Pages Function). It holds the API key, builds the
// prompts, runs the checks in guard.ts on every answer, and stores nothing: no address, no messages, no IP.
// GET /api/ai says whether the AI features are on, so the page can hide them when there's no key.
import Anthropic from "@anthropic-ai/sdk";
import type { AiLang, AiRequest, AiResponse, AiTurn } from "../../src/lib/ai/types";
import { forbiddenWords, stripUnknownCitations, tooHard, unknownCitations, validateRequest } from "../_lib/guard";
import { mockReply } from "../_lib/mock";
import { FALLBACK, explainSystem, narrativeInstruction, staffData, staffSystem, walkwaySystem } from "../_lib/prompts";

interface Env {
  ANTHROPIC_API_KEY?: string;
  /** Default claude-opus-5. claude-sonnet-5 or claude-haiku-4-5 cost less; test them on sample addresses first. */
  AI_MODEL?: string;
  /** "1": canned replies, no API calls (local runs and tests). */
  AI_MOCK?: string;
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

type Ctx = { request: Request; env: Env };

const json = (body: AiResponse | { available: boolean; mock: boolean }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const enabled = (env: Env) => !!env.ANTHROPIC_API_KEY || env.AI_MOCK === "1";

export const onRequestGet = async ({ env }: Ctx) => json({ available: enabled(env), mock: !env.ANTHROPIC_API_KEY && env.AI_MOCK === "1" });

// The three staff files, read once per isolate from the site's own static assets, never from the client.
let staffCache: Promise<ReturnType<typeof staffData>> | null = null;
function loadStaff(env: Env, origin: string) {
  staffCache ??= (async () => {
    const get = async (f: string): Promise<any> => {
      const r = await env.ASSETS.fetch(new URL(`/data/${f}`, origin).toString());
      if (!r.ok) throw new Error(`asset ${f}: ${r.status}`);
      return r.json();
    };
    const [corridors, zoneRequests, zones] = await Promise.all([get("corridors.json"), get("zone_requests.json"), get("zones.json")]);
    return staffData({ corridors, zoneRequests, zones });
  })().catch((e) => {
    staffCache = null;
    throw e;
  });
  return staffCache;
}

/** One model call: the system blocks and the turns in, the answer's text out ("" on a refusal). */
type Generate = (system: Anthropic.Beta.BetaTextBlockParam[], turns: AiTurn[]) => Promise<string>;

function realGenerate(env: Env, req: AiRequest): Generate {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  const model = env.AI_MODEL || "claude-opus-5";
  const staff = req.mode === "staff" || req.mode === "narrative";
  return async (system, turns) => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: staff ? 8000 : 4000,
      // Short, grounded answers: low effort for families, medium for staff questions over the whole dataset.
      // Haiku 4.5 takes no effort setting.
      ...(model.startsWith("claude-haiku") ? {} : { output_config: { effort: staff ? ("medium" as const) : ("low" as const) } }),
      // On a safety-classifier decline, the API re-runs the request on Anthropic's recommended fallback model.
      ...(/^claude-(opus-5|fable-5)/.test(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system,
      messages: turns.map((m) => ({ role: m.role, content: m.text })),
    });
    if (res.stop_reason === "refusal") return "";
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  };
}

/** Add a note from the app to the person's last turn, for the one retry. */
const withNote = (turns: AiTurn[], note: string): AiTurn[] =>
  turns.map((m, i) => (i === turns.length - 1 ? { ...m, text: `${m.text}\n\n(Note from the app, not the person: ${note})` } : m));

export const onRequestPost = async ({ request, env }: Ctx) => {
  if (!enabled(env)) return json({ ok: false, error: "unavailable" }, 503);
  // Browsers send Origin: only this site's own pages may call it from a browser. (Not a rate limit: add one in Cloudflare.)
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: "bad_request", message: "origin" }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  const v = validateRequest(body);
  if (!v.ok) return json({ ok: false, error: "bad_request", message: v.reason }, 400);
  const req = v.req;
  const lang: AiLang = req.mode === "staff" || req.mode === "narrative" ? "en" : req.lang;
  const mock = !env.ANTHROPIC_API_KEY;
  let retries = 0;
  let status = "ok";

  try {
    // ---- Build the prompt ----
    let system: Anthropic.Beta.BetaTextBlockParam[];
    let turns = req.messages;
    let known: Set<string> | null = null;
    let staffHint: Parameters<typeof mockReply>[4];
    if (req.mode === "explain" || req.mode === "walkway") {
      system = [{ type: "text", text: req.mode === "explain" ? explainSystem(lang) : walkwaySystem() }];
      const head = `RESULT\n${JSON.stringify(req.context)}\n\n${req.mode === "walkway" ? "FAMILY'S WORDS\n" : "QUESTION\n"}`;
      turns = turns.map((m, i) => (i === 0 ? { ...m, text: head + m.text } : m));
    } else {
      const data = await loadStaff(env, new URL(request.url).origin);
      known = data.known;
      // Stable first, so the ~30k-token data block is cached across staff conversations.
      system = [
        { type: "text", text: staffSystem() },
        { type: "text", text: data.text, cache_control: { type: "ephemeral" } },
      ];
      if (req.mode === "narrative") {
        const school = data.schools.get(req.nbr!);
        if (!school) return json({ ok: false, error: "bad_request", message: "nbr" }, 400);
        turns = turns.map((m, i) => (i === 0 ? { ...m, text: narrativeInstruction(school, req.nbr!) } : m));
        staffHint = { firstId: `school:${req.nbr}`, school };
      } else {
        staffHint = { firstId: [...known].find((k) => k.startsWith("road:")) ?? "" };
      }
    }

    const generate: Generate = mock
      ? async () => mockReply(req.mode, lang, req.context, req.messages[req.messages.length - 1].text, staffHint)
      : realGenerate(env, req);

    // ---- Answer, check, retry once ----
    const problems = (text: string): string | null => {
      if (!text) return "empty";
      const bad = forbiddenWords(text);
      if (bad.length) return `the answer used ${bad.map((w) => `"${w}"`).join(", ")}, which this page never says. Rewrite it without ${bad.length > 1 ? "them" : "it"}: say what the walk crosses or what the family described instead, and never say anyone qualifies.`;
      if (req.mode === "explain" && tooHard(text, lang)) return "the answer is too hard to read. Rewrite it shorter, in plainer words and shorter sentences.";
      if (known && unknownCitations(text, known).length) return `these bracketed ids aren't in DATA: ${unknownCitations(text, known).join(", ")}. Cite only ids that are in DATA.`;
      return null;
    };
    let text = await generate(system, turns);
    const first = problems(text);
    if (first) {
      retries = 1;
      text = await generate(system, withNote(turns, first));
    }
    const second = problems(text);
    if (second) {
      // A citation that points at nothing is dropped; anything else falls back to a fixed answer.
      if (known && text && !forbiddenWords(text).length && !(req.mode === "explain" && tooHard(text, lang))) {
        text = stripUnknownCitations(text, known);
        status = "stripped";
      } else {
        status = "fallback";
        return json({ ok: true, text: FALLBACK[lang], ...(req.mode === "walkway" ? { kind: "ask" as const } : {}), mock });
      }
    }

    if (req.mode === "walkway") {
      const m = /^\s*(DRAFT|ASK):\s*/i.exec(text);
      const kind = m && m[1].toUpperCase() === "ASK" ? "ask" : "draft";
      return json({ ok: true, text: m ? text.slice(m[0].length).trim() : text, kind, mock });
    }
    return json({ ok: true, text, mock });
  } catch (e) {
    status = "error";
    // The error class, never the request.
    console.error("ai: failed", e instanceof Anthropic.APIError ? `${e.status} ${e.name}` : e instanceof Error ? e.name : "unknown");
    return json({ ok: false, error: "failed" }, 502);
  } finally {
    console.log(JSON.stringify({ ai: req.mode, status, retries, mock, model: mock ? null : env.AI_MODEL || "claude-opus-5" }));
  }
};
