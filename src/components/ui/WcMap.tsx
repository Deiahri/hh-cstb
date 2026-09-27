// The maps: MapLibre with OpenFreeMap's "positron" basemap (light, quiet, no key), drawn the way the static build drew
// them. `walk` is one home's walk, `pick` the closed zones to tap a home in, `zones` the seven zones shaded by hazard.
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { useData } from "../../lib/data";
import type { LngLat } from "../../lib/geo";
import { type UiCheck, type UiCrossing, type UiResult, type UiZone, closedZones, short } from "../../lib/ui/model";
import { isPhone, reduced, useUi } from "./bits";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
type Feat = GeoJSON.Feature;
const fc = (features: Feat[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const lineF = (c: LngLat[], properties = {}): Feat => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates: c } });
const polyF = (rings: LngLat[][], properties = {}): Feat => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: rings } });
const ptF = (p: LngLat, properties = {}): Feat => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: p } });
/** The first `k` (0–1) of a line, by length: the walk drawing itself in. */
function partial(line: LngLat[], k: number): LngLat[] {
  const seg = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  let left = seg.reduce((a, b) => a + b, 0) * k;
  const out: LngLat[] = [line[0]];
  for (let i = 0; i < seg.length; i++) {
    const a = line[i], b = line[i + 1];
    if (left >= seg[i]) {
      out.push(b);
      left -= seg[i];
      continue;
    }
    const f = seg[i] ? left / seg[i] : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    break;
  }
  return out.length > 1 ? out : [line[0], line[0]];
}
const bounds = (pts: LngLat[]): [LngLat, LngLat] => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
};

/** The shuttle pickup: a bus, not a "P" that reads as parking. */
const BUS =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r=".6" fill="currentColor"/><circle cx="16" cy="14.5" r=".6" fill="currentColor"/></svg>';

function marker(m: MlMap, p: LngLat, cls: string, glyph = "", label = ""): Marker {
  const el = document.createElement("div");
  el.className = "mkwrap";
  const mk = document.createElement("div");
  mk.className = `mk ${cls}`;
  if (glyph.startsWith("<svg")) mk.innerHTML = glyph;
  else mk.textContent = glyph;
  el.append(mk);
  if (label) {
    const s = document.createElement("span");
    s.className = "mk-label";
    s.textContent = label;
    el.append(s);
  }
  return new maplibregl.Marker({ element: el, anchor: "top", offset: [0, -11] }).setLngLat(p).addTo(m);
}
function addLine(m: MlMap, id: string, data: GeoJSON.FeatureCollection, paint: maplibregl.LineLayerSpecification["paint"]) {
  m.addSource(id, { type: "geojson", data });
  m.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint });
}

/** "Show on map" and the scroll-spy talk to whichever walk map is mounted through this. */
export interface WalkMapCtl { show: (i: number) => void; hot: (i: number) => void }
const CtlCtx = createContext<{ current: WalkMapCtl | null }>({ current: null });
export function WalkMapProvider({ children }: { children: ReactNode }) {
  const ref = useRef<WalkMapCtl | null>(null);
  return <CtlCtx.Provider value={ref}>{children}</CtlCtx.Provider>;
}
export const useWalkMapCtl = () => useContext(CtlCtx);

/** True on phone widths; follows resizes. */
export function usePhone(): boolean {
  const [p, setP] = useState(isPhone);
  useEffect(() => {
    const q = matchMedia("(max-width:899px)");
    const on = () => setP(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return p;
}

interface Props {
  kind: "walk" | "pick" | "zones" | "print";
  height: number;
  /** The walk to draw (walk and print): a closed-zone result, or any home's check. */
  r?: UiResult;
  c?: UiCheck;
  onPick?: (p: LngLat) => void;
}

/**
 * What the walk map draws, from either shape. `closed` adds the old zone and the shuttle pickup. `path`/`pathBefore` are the
 * walking routes (to the school, to the pickup); null draws a straight line.
 */
interface Drawn { home: LngLat; school: { name: string; loc: LngLat }; now: UiCrossing[]; closed: UiZone | null; path: LngLat[] | null; pathBefore: LngLat[] | null }
const drawnOf = (r?: UiResult, c?: UiCheck): Drawn | null =>
  r ? { home: r.home, school: r.recv, now: r.now, closed: r.closed, path: r.path, pathBefore: r.pathBefore }
    : c ? { home: c.home, school: c.school, now: c.crossings, closed: c.closed, path: c.path, pathBefore: c.pathBefore } : null;

export function WcMap({ kind, height, r: result, c: check, onPick }: Props) {
  const d = useData();
  const { lang, L } = useUi();
  const el = useRef<HTMLDivElement>(null);
  const ctl = useWalkMapCtl();
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current) return;
    const phone = isPhone();
    const interactive = kind !== "print" && (!phone || kind === "pick");
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [-95.33, 29.75],
      zoom: 11,
      attributionControl: { compact: true },
      cooperativeGestures: kind !== "print",
      interactive: kind !== "print",
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      preserveDrawingBuffer: kind === "print",
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": L.coop_win,
        "CooperativeGesturesHandler.MacHelpText": L.coop_mac,
        "CooperativeGesturesHandler.MobileHelpText": L.coop_touch,
      },
    } as maplibregl.MapOptions);
    if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.touchZoomRotate?.disableRotation();
    const zones = closedZones(d);
    let raf = 0;

    const r = drawnOf(result, check);
    m.on("load", () => {
      if ((kind === "walk" || kind === "print") && r) {
        if (r.closed) addLine(m, "zone", fc([lineF(r.closed.rings[0])]), { "line-color": "#111111", "line-width": 1.5, "line-dasharray": [2, 3], "line-opacity": 0.6 });
        const names = new Set(r.now.filter((c) => c.kind === "road").map((c) => c.key.slice(5)));
        const roads = [...d.ds.hin, ...d.ds.pedHin].filter((l) => names.has((l.props.Full_Name ?? "").trim().toUpperCase())).map((l) => l.feature as Feat);
        addLine(m, "roads", fc(roads), { "line-color": "#D7261E", "line-width": 6, "line-opacity": 0.9 });
        if (r.now.some((c) => c.kind === "rail")) addLine(m, "rails", d.raw.rail as unknown as GeoJSON.FeatureCollection, { "line-color": "#111111", "line-width": 2, "line-dasharray": [3, 3], "line-opacity": 0.8 });
        if (r.closed) addLine(m, "pick", fc([lineF(r.pathBefore ?? [r.home, r.closed.loc])]), { "line-color": "#111111", "line-width": 3, "line-dasharray": [0.2, 2.2], "line-opacity": 0.7 });
        const animate = kind === "walk" && !reduced();
        const to = r.school.loc;
        const walkLine = r.path ?? [r.home, to];
        // A route starts and ends on the street network, a little off the pins: those gaps, thin and dashed.
        if (r.path) addLine(m, "walk-gap", fc([lineF([r.home, r.path[0]]), lineF([r.path[r.path.length - 1], to])]), { "line-color": "#111111", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.6 });
        addLine(m, "walk", fc([lineF(animate ? [r.home, r.home] : walkLine)]), { "line-color": "#111111", "line-width": 4, "line-opacity": 0.95 });
        const marks = r.now.map((c, i) => marker(m, c.at, `x${c.kind === "rail" ? " rail" : ""}`, String(i + 1)));
        const lights = r.now.filter((c) => c.control.has && c.control.loc);
        m.addSource("lights", { type: "geojson", data: fc(lights.map((c) => ptF(c.control.loc!, { n: c.control.name }))) });
        m.addLayer({ id: "lights", type: "circle", source: "lights", paint: { "circle-radius": 5, "circle-color": "#111111", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        m.addLayer({
          id: "lights-l", type: "symbol", source: "lights",
          layout: { "text-field": ["get", "n"], "text-size": 11, "text-variable-anchor": ["left", "right", "bottom", "top"], "text-radial-offset": 0.9, "text-justify": "auto", "text-font": ["Noto Sans Regular"] },
          paint: { "text-color": "#111111", "text-halo-color": "#fff", "text-halo-width": 1.5 },
        });
        if (r.closed) marker(m, r.closed.loc, "bus", BUS, r.closed.name);
        marker(m, to, "school", "S", r.school.name);
        marker(m, r.home, "home", "", lang === "es" ? "Casa" : "Home");
        m.fitBounds(bounds([r.home, to, ...walkLine, ...(r.closed ? [r.closed.loc, ...(r.pathBefore ?? [])] : [])]), {
          padding: phone ? { top: 72, bottom: 48, left: 44, right: 44 } : { top: 56, bottom: kind === "print" ? 40 : 132, left: 44, right: 44 },
          duration: 0,
        });
        if (animate) {
          const src = m.getSource("walk") as maplibregl.GeoJSONSource;
          const t0 = performance.now() + 250, dur = 1100, ease = (x: number) => 1 - Math.pow(1 - x, 3);
          const step = (now: number) => {
            const k = Math.min(1, ease(Math.max(0, now - t0) / dur));
            src.setData(fc([lineF(partial(walkLine, k))]));
            if (k < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        }
        if (kind === "walk") {
          const hot = (i: number) => marks.forEach((mk, j) => mk.getElement().classList.toggle("is-hot", j === i));
          ctl.current = {
            hot,
            show: (i) => {
              const c = r.now[i];
              if (!c) return;
              if (isPhone()) el.current?.closest(".mapwrap")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
              m.flyTo({ center: c.at, zoom: 16, duration: reduced() ? 0 : 700, essential: true });
              hot(i);
            },
          };
        }
      }
      if (kind === "pick") {
        m.addSource("zones", { type: "geojson", data: fc(zones.map((z) => polyF(z.rings, { n: short(z.name) }))) });
        m.addLayer({ id: "zones-f", type: "fill", source: "zones", paint: { "fill-color": "#111111", "fill-opacity": 0.08 } });
        m.addLayer({ id: "zones-l", type: "line", source: "zones", paint: { "line-color": "#111111", "line-width": 2 } });
        m.addLayer({ id: "zones-t", type: "symbol", source: "zones", layout: { "text-field": ["get", "n"], "text-size": 13, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#111111", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
        m.fitBounds(bounds(zones.flatMap((z) => z.rings[0])), { padding: 24, duration: 0 });
      }
      if (kind === "zones") {
        m.addSource("zones", { type: "geojson", data: fc(zones.map((z) => polyF(z.rings, { n: short(z.name), v: z.hazNew.combined }))) });
        m.addLayer({ id: "zones-f", type: "fill", source: "zones", paint: { "fill-color": "#D7261E", "fill-opacity": ["+", 0.12, ["*", 0.6, ["/", ["get", "v"], 100]]] } });
        m.addLayer({ id: "zones-l", type: "line", source: "zones", paint: { "line-color": "#111111", "line-width": 1.5 } });
        addLine(m, "sh", fc(zones.flatMap((z) => z.receiving.map((x) => lineF([z.loc, x.loc])))), { "line-color": "#111111", "line-width": 2, "line-dasharray": [0.2, 2.2] });
        m.addSource("rs", { type: "geojson", data: fc(zones.flatMap((z) => z.receiving.map((x) => ptF(x.loc, { n: short(x.name) })))) });
        m.addLayer({ id: "rs", type: "circle", source: "rs", paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#111111", "circle-stroke-width": 2 } });
        m.addSource("ps", { type: "geojson", data: fc(zones.map((z) => ptF(z.loc, { n: `${short(z.name)} · ${Math.round(z.hazNew.combined)}%` }))) });
        m.addLayer({ id: "ps", type: "circle", source: "ps", paint: { "circle-radius": 6, "circle-color": "#111111", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        m.addLayer({
          id: "ps-l", type: "symbol", source: "ps",
          layout: { "text-field": ["get", "n"], "text-size": 12, "text-font": ["Noto Sans Bold"], "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 0.8, "text-justify": "auto" },
          paint: { "text-color": "#111111", "text-halo-color": "#fff", "text-halo-width": 1.6 },
        });
        m.fitBounds(bounds(zones.flatMap((z) => z.rings[0])), { padding: 32, duration: 0 });
      }
    });

    let pin: Marker | null = null;
    if (kind === "pick") {
      m.getCanvas().style.cursor = "crosshair";
      m.on("click", (e) => {
        const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
        if (pin) pin.setLngLat(p);
        else pin = marker(m, p, "home");
        pick.current?.(p);
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      if (kind === "walk") ctl.current = null;
      m.remove();
    };
    // One map per result and language; the rest is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, result, check, lang, d]);

  return <div ref={el} className="map" data-map={kind} style={{ height }} role="img" aria-label="Map" />;
}

/** The walk map with its key, as the walk page shows it. */
export function WalkMap({ r, c, height }: { r?: UiResult; c?: UiCheck; height: number }) {
  const { L } = useUi();
  const closed = !!(r?.closed ?? c?.closed);
  const routed = !!(r?.path ?? c?.path);
  return (
    <div className="mapwrap">
      <WcMap kind="walk" r={r} c={c} height={height} />
      <details className="maplegend" open={!isPhone()}>
        <summary>{L.key}</summary>
        <ul>
          <li><i className="l-walk" />{routed ? L.map_walk : L.map_line}</li>
          {closed && <li><i className="l-pick" />{L.map_pick}</li>}
          {closed && <li><i className="l-bus" />{L.map_bus}</li>}
          <li><i className="l-x">1</i>{L.map_x}</li>
          <li><i className="l-light" />{L.map_light}</li>
          <li><i className="l-road" />{L.map_road}</li>
          <li><i className="l-rail" />{L.map_rail}</li>
        </ul>
      </details>
    </div>
  );
}
