import { haversine, type LngLat } from "./geo";

export interface WalkingRoute {
  coordinates: LngLat[];
  distanceM: number;
  /** Distance from the requested pins to the network; these gaps are NOT routed. */
  startGapM: number;
  endGapM: number;
}
export type RoutingState =
  | { status: "loading" | "unavailable" }
  | { status: "ready"; route: WalkingRoute };

export const validPoint = (p: unknown): p is LngLat => Array.isArray(p) && p.length === 2 &&
  p.every((n) => typeof n === "number" && Number.isFinite(n)) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
export const routeKey = (from: LngLat, to: LngLat) => JSON.stringify([from, to]);

/** Reject empty, swapped, distant or malformed network responses before drawing them. */
export function parseWalkingRoute(value: unknown, from: LngLat, to: LngLat): WalkingRoute {
  const v = value as { coordinates?: unknown; distanceM?: unknown } | null;
  if (!v || !Array.isArray(v.coordinates) || v.coordinates.length < 2 || v.coordinates.length > 30000 ||
      !v.coordinates.every(validPoint) || typeof v.distanceM !== "number" || !Number.isFinite(v.distanceM) ||
      v.distanceM < 0 || v.distanceM > 100000) throw new Error("Invalid walking route");
  const coordinates = v.coordinates as LngLat[];
  const startGapM = haversine(from, coordinates[0]);
  const endGapM = haversine(to, coordinates[coordinates.length - 1]);
  if (startGapM > 250 || endGapM > 250) throw new Error("Route endpoints too far from pins");
  const length = coordinates.slice(1).reduce((n, p, i) => n + haversine(coordinates[i], p), 0);
  if (!Number.isFinite(length) || Math.abs(length - v.distanceM) > Math.max(100, length * 0.15))
    throw new Error("Route distance does not match geometry");
  return { coordinates, distanceM: v.distanceM, startGapM, endGapM };
}

/** Memory-only, bounded cache: home coordinates are never put in persistent browser storage. */
export function createWalkingClient(fetcher: typeof fetch = fetch, now = Date.now, timeoutMs = 14_000) {
  const cache = new Map<string, { at: number; route: WalkingRoute }>();
  return async (from: LngLat, to: LngLat, signal: AbortSignal): Promise<WalkingRoute> => {
    signal.throwIfAborted();
    if (!validPoint(from) || !validPoint(to)) throw new Error("Invalid coordinates");
    const key = routeKey(from, to), cached = cache.get(key);
    if (cached && now() - cached.at < 5 * 60_000) return cached.route;
    const response = await fetcher(`${import.meta.env?.BASE_URL ?? "/"}api/walk`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [from, to] }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    if (!response.ok) throw new Error("Walking route unavailable");
    const route = parseWalkingRoute(await response.json(), from, to);
    signal.throwIfAborted();
    cache.delete(key);
    cache.set(key, { at: now(), route });
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    return route;
  };
}

export const getWalkingRoute = createWalkingClient();
