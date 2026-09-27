// The page's side of /api/ai. The proxy holds the key; this sends the question and the page's own result.
import { useEffect, useState } from "react";
import type { AiRequest, AiResponse } from "./types";

// The API is a separate service (server/). VITE_API_URL is its base URL, baked in at build time; unset, the page asks its own
// origin, which in `npm run dev` vite proxies to the local server.
const API = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/ai`;

export interface AiStatus { available: boolean; mock: boolean }
const OFF: AiStatus = { available: false, mock: false };

let status: Promise<AiStatus> | null = null;
/** Is the AI proxy there and switched on? Asked once per page load; no API, or one that's off, answers no. */
export function aiStatus(): Promise<AiStatus> {
  status ??= fetch(API, { headers: { accept: "application/json" } })
    .then((r) => (r.ok && r.headers.get("content-type")?.includes("json") ? r.json() : OFF))
    .then((b: Partial<AiStatus>) => ({ available: b.available === true, mock: b.mock === true }))
    .catch(() => OFF);
  return status;
}

/** The AI features render only once the proxy says it's on; until then, and with no API, they're absent. */
export function useAiStatus(): AiStatus {
  const [s, setS] = useState<AiStatus>(OFF);
  useEffect(() => {
    let live = true;
    aiStatus().then((v) => live && setS(v));
    return () => {
      live = false;
    };
  }, []);
  return s;
}

export async function askAI(req: AiRequest): Promise<AiResponse> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req), signal: ctl.signal });
    const body = (await r.json().catch(() => null)) as AiResponse | null;
    if (body) return body;
    return { ok: false, error: r.status === 503 ? "unavailable" : "failed" };
  } catch {
    return { ok: false, error: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
