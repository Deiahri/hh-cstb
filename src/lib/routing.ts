// The walking route between a home and a school, from /api/walk (server/walk.ts: OpenRouteService, foot-walking). Checked
// here again before anything is drawn from it; when there's no route, the walks stay straight lines.
import { apiUrl } from "./api";
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

/**
 * Memory-only, bounded cache: home coordinates are never put in persistent browser storage. A failure is remembered for a
 * minute too, so moving between walk screens with the API off doesn't wait on it again each time.
 */
export function createWalkingClient(fetcher: typeof fetch = fetch, now = Date.now, timeoutMs = 12_000) {
  const cache = new Map<string, { at: number; route: WalkingRoute }>();
  const failed = new Map<string, number>();
  const get = async (from: LngLat, to: LngLat, signal: AbortSignal): Promise<WalkingRoute> => {
    signal.throwIfAborted();
    if (!validPoint(from) || !validPoint(to)) throw new Error("Invalid coordinates");
    const key = routeKey(from, to), cached = cache.get(key);
    if (cached && now() - cached.at < 5 * 60_000) return cached.route;
    // Don't ask again so soon: a route arriving now would change a screen that already showed the straight line.
    const fail = failed.get(key);
    if (fail !== undefined && now() - fail < 60_000) throw new Error("Walking route unavailable");
    let route: WalkingRoute;
    try {
      const response = await fetcher(apiUrl("/api/walk"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [from, to] }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      if (!response.ok) throw new Error("Walking route unavailable");
      route = parseWalkingRoute(await response.json(), from, to);
    } catch (e) {
      if (!signal.aborted) {
        failed.set(key, now());
        if (failed.size > 64) failed.delete(failed.keys().next().value!);
      }
      throw e;
    }
    signal.throwIfAborted();
    failed.delete(key);
    cache.delete(key);
    cache.set(key, { at: now(), route });
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    return route;
  };
  /** What's already known for this walk, without asking: a cached route, a recent failure, or nothing. */
  const peek = (from: LngLat, to: LngLat): RoutingState | undefined => {
    const key = routeKey(from, to), cached = cache.get(key), fail = failed.get(key);
    if (cached && now() - cached.at < 5 * 60_000) return { status: "ready", route: cached.route };
    if (fail !== undefined && now() - fail < 60_000) return { status: "unavailable" };
    return undefined;
  };
  return Object.assign(get, { peek });
}

export const getWalkingRoute = createWalkingClient();
