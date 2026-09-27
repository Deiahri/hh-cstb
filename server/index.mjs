import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const ORS_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const localPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
  p[0] >= -96 && p[0] <= -94.7 && p[1] >= 28.8 && p[1] <= 30.5;
const validRequest = (v) => Array.isArray(v?.coordinates) && v.coordinates.length === 2 && v.coordinates.every(localPoint);
const meters = (a, b) => {
  const rad = Math.PI / 180, lat = (b[1] - a[1]) * rad, lng = (b[0] - a[0]) * rad;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(lat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(lng / 2) ** 2)));
};

/** One same-origin production server: static Vite build + narrowly scoped pedestrian API. */
export function createApp({ apiKey = process.env.ORS_API_KEY, fetcher = fetch, now = Date.now,
  timeoutMs = 10000, perMinute = Number(process.env.ROUTING_REQUESTS_PER_MINUTE) || 30 } = {}) {
  const cache = new Map();
  const inFlight = new Map();
  let windowStart = now(), requests = 0;
  const json = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
  };
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/healthz") { json(res, 200, { ok: true, routingConfigured: !!apiKey }); return; }
      if (url.pathname === "/api/walk") {
        if (req.method !== "POST") { res.setHeader("Allow", "POST"); json(res, 405, { error: "method" }); return; }
        if (!apiKey) { json(res, 503, { error: "routing_unconfigured" }); return; }
        if (!req.headers["content-type"]?.startsWith("application/json")) { json(res, 415, { error: "content_type" }); return; }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 2048) { json(res, 413, { error: "too_large" }); return; }
        }
        let input;
        try { input = JSON.parse(body); } catch { json(res, 400, { error: "invalid_json" }); return; }
        if (!validRequest(input)) { json(res, 400, { error: "invalid_coordinates" }); return; }
        const key = JSON.stringify(input.coordinates), cached = cache.get(key);
        if (cached && now() - cached.at < 5 * 60_000) { json(res, 200, cached.value); return; }
        if (!inFlight.has(key)) {
          if (now() - windowStart >= 60_000) { windowStart = now(); requests = 0; }
          if (requests >= perMinute) { res.setHeader("Retry-After", "60"); json(res, 429, { error: "busy" }); return; }
          requests++;
          const pending = (async () => {
            const upstream = await fetcher(ORS_URL, {
              method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
              // Restrict snapping; do not route from a distant street or use a driving profile.
              body: JSON.stringify({ coordinates: input.coordinates, radiuses: [200, 200], instructions: false }),
              signal: AbortSignal.timeout(timeoutMs),
            });
            if (!upstream.ok) throw new Error("upstream");
            const data = await upstream.json(), feature = data?.features?.[0];
            const coordinates = feature?.geometry?.coordinates, distanceM = feature?.properties?.summary?.distance;
            if (feature?.geometry?.type !== "LineString" || !Array.isArray(coordinates) ||
                coordinates.length < 2 || coordinates.length > 30000 || !coordinates.every(localPoint) ||
                !Number.isFinite(distanceM) || distanceM < 0 || distanceM > 100000) throw new Error("invalid_upstream");
            const length = coordinates.slice(1).reduce((n, p, i) => n + meters(coordinates[i], p), 0);
            if (meters(input.coordinates[0], coordinates[0]) > 250 ||
                meters(input.coordinates[1], coordinates[coordinates.length - 1]) > 250 ||
                Math.abs(length - distanceM) > Math.max(100, length * 0.15)) throw new Error("invalid_upstream");
            const value = { coordinates, distanceM };
            cache.delete(key);
            cache.set(key, { at: now(), value });
            if (cache.size > 128) cache.delete(cache.keys().next().value);
            return value;
          })();
          inFlight.set(key, pending);
        }
        const pending = inFlight.get(key);
        try { json(res, 200, await pending); }
        catch { json(res, 502, { error: "routing_unavailable" }); }
        finally { if (inFlight.get(key) === pending) inFlight.delete(key); }
        return;
      }
      if (url.pathname.startsWith("/api/")) { json(res, 404, { error: "not_found" }); return; }
      if (req.method !== "GET" && req.method !== "HEAD") { json(res, 405, { error: "method" }); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { json(res, 400, { error: "path" }); return; }
      const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!file.startsWith(root + sep)) { json(res, 404, { error: "not_found" }); return; }
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) { json(res, 404, { error: "not_found" }); return; }
      res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Content-Length": info.size, "X-Content-Type-Options": "nosniff",
        "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch { if (!res.headersSent) json(res, 500, { error: "request_failed" }); else res.destroy(); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.requestTimeout = 20000;
  server.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => console.log("App listening; routing", process.env.ORS_API_KEY ? "configured" : "unconfigured"));
}
