import { useEffect, useMemo, useState } from "react";
import { analyzeAddress, type AddressResult, type Dataset, type RouteResult } from "./analyze";
import type { LngLat } from "./geo";
import { getWalkingRoute, routeKey, validPoint, type RoutingState } from "./routing";
import { hazardsOnPath } from "./route-hazards";

export function withWalkingRoutes(base: AddressResult, states: Record<string, RoutingState>, ds: Dataset): AddressResult {
  const enrich = (r?: RouteResult): RouteResult | undefined => {
    if (!r) return undefined;
    const routing = states[routeKey(base.point, r.school.loc)] ?? { status: "loading" as const };
    return { ...r, routing, hazards: routing.status === "ready" ? hazardsOnPath(routing.route.coordinates, ds) : r.hazards };
  };
  const old = enrich(base.old), now = enrich(base.now);
  const comparable = old?.routing?.status === "ready" && now?.routing?.status === "ready";
  const oldKeys = new Set(old?.hazards.map((h) => h.key));
  return { ...base, old, now, newlyCrossed: comparable ? now.hazards.filter((h) => !oldKeys.has(h.key)) : [] };
}

/** Shared by all address pages; never changes the synchronous precompute analysis. */
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
  return useMemo(() => base ? withWalkingRoutes(base, loaded.key === key ? loaded.states : {}, ds) : null, [base, loaded, key, ds]);
}

export function walkingFitPoints(r: AddressResult): LngLat[] {
  return [r.point, ...[r.old, r.now].flatMap((route) => !route ? [] : [route.school.loc,
    ...(route.routing?.status === "ready" ? route.routing.route.coordinates : [])])];
}
