// POST /api/walk — a walking route between a home and a school, from OpenRouteService's foot-walking profile (served by
// server/index.ts). The key stays here. The page sends two points and gets back the route's line and length; nothing is
// stored beyond a five-minute cache in memory.
type LngLat = [number, number];

const ORS_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

/** Inside the Houston area, [lng, lat]. Swapped or far-off points are refused. */
const localPoint = (p: unknown): p is LngLat =>
  Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= -96 && p[0] <= -94.7 && p[1] >= 28.8 && p[1] <= 30.5;
const validRequest = (v: unknown): v is { coordinates: [LngLat, LngLat] } => {
  const c = (v as { coordinates?: unknown } | null)?.coordinates;
  return Array.isArray(c) && c.length === 2 && c.every(localPoint);
};
const meters = (a: LngLat, b: LngLat) => {
  const rad = Math.PI / 180, lat = (b[1] - a[1]) * rad, lng = (b[0] - a[0]) * rad;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(lat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(lng / 2) ** 2)));
};

export interface WalkRoute { coordinates: LngLat[]; distanceM: number }
export interface WalkReply { status: number; body: unknown; headers?: Record<string, string> }
export interface WalkOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  /** Calls to ORS per minute across everyone; cache hits don't count. */
  perMinute?: number;
}

export function createWalkRoute({ apiKey, fetcher = fetch, now = Date.now, timeoutMs = 8000, perMinute = 30 }: WalkOptions = {}) {
  const cache = new Map<string, { at: number; value: WalkRoute }>();
  const inFlight = new Map<string, Promise<WalkRoute>>();
  let windowStart = now(), requests = 0;

  async function fetchRoute(coordinates: [LngLat, LngLat]): Promise<WalkRoute> {
    const upstream = await fetcher(ORS_URL, {
      method: "POST",
      headers: { Authorization: apiKey!, "Content-Type": "application/json" },
      // Snap no further than 200 m, so the walk doesn't start from some other street.
      body: JSON.stringify({ coordinates, radiuses: [200, 200], instructions: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!upstream.ok) throw new Error("upstream");
    const data = (await upstream.json()) as { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: { summary?: { distance?: unknown } } }[] };
    const feature = data?.features?.[0];
    const line = feature?.geometry?.coordinates, distanceM = feature?.properties?.summary?.distance;
    if (feature?.geometry?.type !== "LineString" || !Array.isArray(line) || line.length < 2 || line.length > 30000 || !line.every(localPoint) ||
        typeof distanceM !== "number" || !Number.isFinite(distanceM) || distanceM < 0 || distanceM > 100000) throw new Error("invalid_upstream");
    const length = line.slice(1).reduce((n: number, p: LngLat, i: number) => n + meters(line[i], p), 0);
    if (meters(coordinates[0], line[0]) > 250 || meters(coordinates[1], line[line.length - 1]) > 250 ||
        Math.abs(length - distanceM) > Math.max(100, length * 0.15)) throw new Error("invalid_upstream");
    return { coordinates: line, distanceM };
  }

  /** The reply for one parsed request body. */
  return async function walk(input: unknown): Promise<WalkReply> {
    if (!apiKey) return { status: 503, body: { error: "routing_unconfigured" } };
    if (!validRequest(input)) return { status: 400, body: { error: "invalid_coordinates" } };
    const key = JSON.stringify(input.coordinates), hit = cache.get(key);
    if (hit && now() - hit.at < 5 * 60_000) return { status: 200, body: hit.value };
    let pending = inFlight.get(key);
    if (!pending) {
      if (now() - windowStart >= 60_000) { windowStart = now(); requests = 0; }
      if (requests >= perMinute) return { status: 429, body: { error: "busy" }, headers: { "retry-after": "60" } };
      requests++;
      pending = fetchRoute(input.coordinates).then((value) => {
        cache.delete(key);
        cache.set(key, { at: now(), value });
        if (cache.size > 128) cache.delete(cache.keys().next().value!);
        return value;
      });
      inFlight.set(key, pending);
    }
    try {
      return { status: 200, body: await pending };
    } catch {
      return { status: 502, body: { error: "routing_unavailable" } };
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    }
  };
}
