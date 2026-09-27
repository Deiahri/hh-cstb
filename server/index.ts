// The Walk Check API: a plain Node server for /api/ai (ai.ts). The site itself is a static build hosted separately, so
// this answers CORS for the site's origin, caps request size, and rate-limits the calls that cost money.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type Env, allowedOrigins, onRequestGet, onRequestPost } from "./ai";

const env = process.env as Env;
const PORT = Number(process.env.PORT) || 8788;
const MAX_BODY = 64 * 1024;

// ---- Rate limit, in memory: per IP over ten minutes, and for everyone over an hour ----
const PER_IP = 20, IP_WINDOW = 10 * 60_000, HOUR = 60 * 60_000;
const perHour = Number(env.AI_MAX_PER_HOUR) || 300;
const byIp = new Map<string, { n: number; until: number }>();
let all = { n: 0, until: 0 };
/** Count one POST; false when over a limit. */
function allow(ip: string, now = Date.now()) {
  if (now >= all.until) all = { n: 0, until: now + HOUR };
  const e = byIp.get(ip);
  const mine = e && now < e.until ? e : { n: 0, until: now + IP_WINDOW };
  if (mine.n >= PER_IP || all.n >= perHour) return false;
  mine.n++;
  all.n++;
  byIp.set(ip, mine);
  return true;
}
// Forget expired IPs.
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of byIp) if (now >= e.until) byIp.delete(ip);
}, IP_WINDOW).unref();

/** Render's proxy puts the client first in x-forwarded-for. A caller can forge that header to dodge the per-IP limit, so the
 *  hourly cap is the real ceiling on the bill. */
const clientIp = (req: IncomingMessage) => (String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress || "?");

function cors(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins(env).includes(origin)) return { vary: "Origin" };
  return {
    vary: "Origin",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body = "") {
  res.writeHead(status, headers);
  res.end(body);
}
const jsonError = (error: "failed" | "bad_request", message?: string) => JSON.stringify({ ok: false, error, ...(message ? { message } : {}) });
const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

/** The body, or null past MAX_BODY. */
async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) return null;
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const h = cors(req);
  if (url.pathname === "/healthz") return send(res, 200, { "content-type": "text/plain" }, "ok");
  if (url.pathname !== "/api/ai") return send(res, 404, { "content-type": "text/plain" }, "Not found");
  if (req.method === "OPTIONS") return send(res, 204, h);
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { ...h, allow: "GET, POST, OPTIONS" });

  let request: Request;
  if (req.method === "POST") {
    const body = await readBody(req);
    if (!body) return send(res, 413, { ...h, ...JSON_HEADERS, connection: "close" }, jsonError("bad_request", "too_large"));
    if (!allow(clientIp(req))) return send(res, 429, { ...h, ...JSON_HEADERS, "retry-after": "600" }, jsonError("failed"));
    request = new Request(url, { method: "POST", headers: req.headers as Record<string, string>, body: new Uint8Array(body) });
  } else {
    request = new Request(url, { headers: req.headers as Record<string, string> });
  }
  const out = await (req.method === "POST" ? onRequestPost : onRequestGet)({ request, env });
  send(res, out.status, { ...h, ...Object.fromEntries(out.headers) }, await out.text());
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error("server:", e instanceof Error ? e.name : "unknown");
    if (!res.headersSent) send(res, 500, JSON_HEADERS, jsonError("failed"));
  });
}).listen(PORT, () => console.log(`Walk Check API on :${PORT}`));
