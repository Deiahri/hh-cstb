import type { RouteResult } from "../lib/analyze";
import { mi } from "../lib/format";
import { useT, type Dict } from "../lib/i18n";

export function routeDistanceText(route: RouteResult, t: Dict): string {
  return route.routing?.status === "ready"
    ? t.routing.distance(mi(route.routing.route.distanceM))
    : t.result.miles(mi(route.distance));
}

/** Include the geometry basis in shared text as well as on-screen summaries. */
export function routeSummaryText(route: RouteResult, t: Dict): string {
  const rail = route.hazards.some((h) => h.kind === "rail");
  const roads = route.hazards.filter((h) => h.kind === "road").length;
  return `${t.result.crosses(rail, roads)} ${routeDistanceText(route, t)}. ${t.routing[route.routing?.status ?? "unavailable"]} ${t.routing.caveat}`;
}

export function RouteDistance({ route }: { route: RouteResult }) {
  const { t } = useT();
  return <>{routeDistanceText(route, t)}</>;
}

export function RouteStatus({ route }: { route: RouteResult }) {
  const { t } = useT();
  const state = route.routing;
  return <div className="small muted route-status" role="status">
    <p>{t.routing[state?.status ?? "unavailable"]}</p>
    {state?.status === "ready" && <p>{t.routing.endpoints(Math.round(state.route.startGapM), Math.round(state.route.endGapM))}</p>}
    <p>{t.routing.caveat}</p>
  </div>;
}
