import { type ReactNode, useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useData } from "../lib/data";
import { useT } from "../lib/i18n";
import type { LngLat } from "../lib/geo";

export const COLORS = {
  rail: "#7c3aed",
  ped: "#dc2626",
  hin: "#ea580c",
  oldRoute: "#6b7280",
  newRoute: "#1d4ed8",
  zone: "#0f766e",
  // School-bus yellow, cased in dark amber so it stays visible over OSM's yellow roads.
  shuttle: "#facc15",
  shuttleInk: "#854d0e",
  // Where to cross: the lights and rail crossings a walk plan names, and the walk drawn through them. Cyan, so it
  // isn't mistaken for the green "S" stop pin.
  plan: "#0891b2",
};

/** Refit the map whenever the set of points changes. */
export function FitTo({ points, maxZoom = 16 }: { points: LngLat[]; maxZoom?: number }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points.map(([x, y]) => [y, x] as [number, number]));
    // The container can settle its size after first render (grid layout, fonts),
    // so refit whenever it resizes, not just once.
    let last = "";
    const fit = () => {
      const el = map.getContainer();
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === last || !el.clientWidth) return;
      last = size;
      map.invalidateSize({ animate: false });
      map.fitBounds(b, { padding: [36, 36], maxZoom, animate: false });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, maxZoom]);
  return null;
}

/** Faint citywide context: every hazard segment in the snapshot. */
export function HazardContext() {
  const d = useData();
  return (
    <>
      <GeoJSON data={d.raw.hin as any} style={{ color: COLORS.hin, weight: 2, opacity: 0.25 }} interactive={false} />
      <GeoJSON data={d.raw.ped_hin as any} style={{ color: COLORS.ped, weight: 2, opacity: 0.3 }} interactive={false} />
      <GeoJSON data={d.raw.rail as any} style={{ color: COLORS.rail, weight: 1.5, opacity: 0.35, dashArray: "4 3" }} interactive={false} />
    </>
  );
}

export function MapBase({
  children, className = "map", interactive = true, context = true,
}: { children?: ReactNode; className?: string; interactive?: boolean; context?: boolean }) {
  return (
    <MapContainer
      className={className}
      center={[29.78, -95.33]}
      zoom={12}
      preferCanvas
      zoomControl={interactive}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        crossOrigin
      />
      {context && <HazardContext />}
      {children}
    </MapContainer>
  );
}

/** `walks` adds the two straight-line walks an address result draws (Lookup and the packet); `plan` the where-to-cross marks. */
export function MapLegend({ shuttle = false, walks = false, plan = false }: { shuttle?: boolean; walks?: boolean; plan?: boolean }) {
  const { t } = useT();
  const l = t.legend;
  return (
    <ul className="legend" aria-label={l.aria}>
      {walks && (
        <>
          <li><span className="swatch" style={{ background: COLORS.newRoute }} /> {l.walkNow}</li>
          <li><span className="swatch dashed" style={{ borderColor: COLORS.oldRoute }} /> {l.walkOld}</li>
        </>
      )}
      {plan && (
        <>
          <li><span className="swatch dot" style={{ background: COLORS.plan }} /> {l.controls}</li>
          <li><span className="swatch dotted" style={{ borderColor: COLORS.plan }} /> {l.path}</li>
        </>
      )}
      {shuttle && (
        <li>
          <span className="swatch shuttle" style={{ background: COLORS.shuttle, borderColor: COLORS.shuttleInk }} /> {l.shuttle}
        </li>
      )}
      <li><span className="swatch" style={{ background: COLORS.ped }} /> {l.ped}</li>
      <li><span className="swatch" style={{ background: COLORS.hin }} /> {l.hin}</li>
      <li><span className="swatch dashed" style={{ borderColor: COLORS.rail }} /> {l.rail}</li>
    </ul>
  );
}

export const pinIcon = (label: string, cls: string) =>
  L.divIcon({ className: `pin ${cls}`, html: `<span>${label}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
