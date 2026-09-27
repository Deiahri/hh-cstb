import { Fragment } from "react";
import { CircleMarker, GeoJSON, Marker, Polyline, Tooltip } from "react-leaflet";
import type { AddressResult } from "../lib/analyze";
import { type WalkPlan, controlLabel, railKind } from "../lib/crossings";
import { type AppData, type ShuttleStat, segmentFeatures } from "../lib/data";
import type { LngLat } from "../lib/geo";
import { useT } from "../lib/i18n";
import { COLORS, pinIcon } from "./MapBase";
import { hazardName } from "./HazardList";
import { ShuttleLayer } from "./ShuttleLayer";
import { RouteDistance } from "./RouteStatus";

const ll = ([x, y]: LngLat) => [y, x] as [number, number];

/** Nearby controls are context only; they are not waypoints or directions off the route. */
function PlanLayers({ plans }: { plans: WalkPlan[] }) {
  const { t } = useT();
  const seen = new Set<string>();
  const marks = plans.flatMap((p) => p.steps).filter((s) => s.near && s.control && !seen.has(`${s.control.loc}`) && !!seen.add(`${s.control.loc}`));
  return (
    <>
      {marks.map(({ control: c }) => (
        <CircleMarker key={`${c!.loc}`} center={ll(c!.loc)} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS.plan, fillOpacity: 1 }}>
          <Tooltip>{c!.kind === "signal" ? t.cross.lightTip(controlLabel(c!)) : t.cross.railTip(controlLabel(c!), t.cross.railKinds[railKind(c!.xing)])}</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

/** Shared route geometry and its potential hazard intersections, or labeled straight-line estimates. */
export function RouteLayers({ d, r, stop, shuttle, plans }: { d: AppData; r: AddressResult; stop?: LngLat; shuttle?: ShuttleStat; plans?: WalkPlan[] }) {
  const { t } = useT();
  const crossedNew = r.now ? r.now.hazards.flatMap((h) => h.lineIds) : [];
  const crossedOld = r.old ? r.old.hazards.flatMap((h) => h.lineIds) : [];
  const seen = new Set<string>();
  const segs = [...crossedNew, ...crossedOld].filter((s) => !seen.has(`${s.layer}${s.id}`) && seen.add(`${s.layer}${s.id}`));
  const feats = segmentFeatures(d, segs).map((f, i) => ({ ...f, properties: { ...f.properties, _layer: segs[i].layer } }));
  const color = { rail: COLORS.rail, pedHin: COLORS.ped, hin: COLORS.hin } as const;
  // Potential intersections on both walks; the old-campus route also serves the shuttle pickup.
  const marked = new Set<string>();
  const marks = [...(r.now?.hazards ?? []), ...(r.old?.hazards ?? [])].filter((h) => {
    const k = `${h.key}@${h.at.join()}`;
    return !marked.has(k) && !!marked.add(k);
  });
  return (
    <>
      <GeoJSON
        key={segs.map((s) => s.layer + s.id).join()}
        data={{ type: "FeatureCollection", features: feats } as any}
        style={(f) => ({ color: color[f?.properties._layer as keyof typeof color], weight: 7, opacity: 0.85 })}
      />
      {([r.old, r.now] as const).map((route, i) => {
        if (!route) return null;
        const ready = route.routing?.status === "ready" ? route.routing.route : null;
        const color = i ? COLORS.newRoute : COLORS.oldRoute;
        return <Fragment key={i}>
          <Polyline positions={(ready?.coordinates ?? [r.point, route.school.loc]).map(ll)}
            pathOptions={{ color, weight: i ? 4 : 3, dashArray: !ready || !i ? "6 6" : undefined }}>
            <Tooltip>{route.school.name}: <RouteDistance route={route} />. {t.routing[route.routing?.status ?? "unavailable"]}</Tooltip>
          </Polyline>
          {ready && [ready.coordinates[0], ready.coordinates[ready.coordinates.length - 1]].map((p, j) => (
            <CircleMarker key={j} center={ll(p)} radius={5} pathOptions={{ color, fillColor: "white", fillOpacity: 1 }}>
              <Tooltip>{t.routing.endpoint}</Tooltip>
            </CircleMarker>
          ))}
        </Fragment>;
      })}
      {marks.map((h) => (
        <CircleMarker key={`${h.key}@${h.at.join()}`} center={ll(h.at)} radius={6} pathOptions={{ color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 }}>
          <Tooltip>{hazardName(h, t)}</Tooltip>
        </CircleMarker>
      ))}
      {plans && <PlanLayers plans={plans} />}
      {shuttle && <ShuttleLayer shuttles={[shuttle]} hideDropAt={r.now?.school.nbr} />}
      {r.old && !shuttle && (
        <Marker position={ll(r.old.school.loc)} icon={pinIcon("25", "pin-old")}>
          <Tooltip>{t.lookup.lastYear(r.old.school.name)}</Tooltip>
        </Marker>
      )}
      {r.now && (
        <Marker position={ll(r.now.school.loc)} icon={pinIcon("26", "pin-new")}>
          <Tooltip>{t.lookup.thisYear(r.now.school.name)}</Tooltip>
        </Marker>
      )}
      <Marker position={ll(r.point)} icon={pinIcon("⌂", "pin-home")}>
        <Tooltip>{t.lookup.home}</Tooltip>
      </Marker>
      {stop && (
        <Marker position={ll(stop)} icon={pinIcon("S", "pin-stop")}>
          <Tooltip>{t.lookup.stop}</Tooltip>
        </Marker>
      )}
    </>
  );
}
