// One address's two walks (last year's school and this year's) as walking routes: asked of /api/walk once per address, and
// the hazards found along the route that comes back. Until a route comes back, and when none does, the straight line stands.
import { useEffect, useMemo, useState } from "react";
import { analyzeAddress, type AddressResult, type Dataset, type RouteResult } from "./analyze";
import type { LngLat } from "./geo";
import { getWalkingRoute, routeKey, validPoint, type RoutingState } from "./routing";
import { hazardsOnPath } from "./route-hazards";

/** `known`: what the client already has for a walk (a cached route or a recent failure), so a screen can skip the wait. */
export function withWalkingRoutes(base: AddressResult, states: Record<string, RoutingState>, ds: Dataset,
  known: (from: LngLat, to: LngLat) => RoutingState | undefined = () => undefined): AddressResult {
  const enrich = (r?: RouteResult): RouteResult | undefined => {
    if (!r) return undefined;
    const routing = states[routeKey(base.point, r.school.loc)] ?? known(base.point, r.school.loc) ?? { status: "loading" as const };
    return { ...r, routing, hazards: routing.status === "ready" ? hazardsOnPath(routing.route.coordinates, ds) : r.hazards };
  };
  const old = enrich(base.old), now = enrich(base.now);
  const ready = [old, now].filter((r) => r?.routing?.status === "ready").length;
  const oldKeys = new Set(old?.hazards.map((h) => h.key));
  // Compare like with like: both routed, or both straight. One of each has no honest answer.
  const newlyCrossed = ready === 2 && now ? now.hazards.filter((h) => !oldKeys.has(h.key)) : ready === 0 ? base.newlyCrossed : [];
  return { ...base, old, now, newlyCrossed };
}

/** Every walk screen's address, analysed and then routed. The straight-line analysis (analyzeAddress) is unchanged. */
export function useWalkingAddress(point: LngLat | null, ds: Dataset) {
  const base = useMemo(() => point && validPoint(point) ? analyzeAddress(point, ds) : null, [point?.[0], point?.[1], ds]);
  const key = base ? JSON.stringify([base.point, base.old?.school.loc, base.now?.school.loc]) : "";
  const [loaded, setLoaded] = useState<{ key: string; states: Record<string, RoutingState> }>({ key: "", states: {} });
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    const requests = new Map([base.old, base.now].filter((r): r is RouteResult => !!r)
      .map((r) => [routeKey(base.point, r.school.loc), r.school.loc]));
    setLoaded({ key, states: {} });
    for (const [routeId, dest] of requests) {
      const publish = (state: RoutingState) => {
        if (!controller.signal.aborted) setLoaded((s) => s.key === key ? { key, states: { ...s.states, [routeId]: state } } : s);
      };
      getWalkingRoute(base.point, dest, controller.signal)
        .then((route) => publish({ status: "ready", route }), () => publish({ status: "unavailable" }));
    }
    return () => controller.abort();
  }, [base, key]);
  // Hide prior-address results immediately, before the effect runs.
  return useMemo(() => base ? withWalkingRoutes(base, loaded.key === key ? loaded.states : {}, ds, getWalkingRoute.peek) : null, [base, loaded, key, ds]);
}

/** A route still waiting on /api/walk. */
export const routePending = (r: AddressResult) => [r.old, r.now].some((x) => x?.routing?.status === "loading");
