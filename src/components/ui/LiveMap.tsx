// A plain MapLibre map for the staff pages that change every second (/sim) or show many sized dots (/sensors): the
// closed zones, some lines, some circles, and labeled HTML markers, all updated in place from props. Same basemap as
// WcMap.
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { LngLat } from "../../lib/geo";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface MapLine { id: string; coords: LngLat[]; color: string; width?: number; dashed?: boolean }
export interface MapDot { id: string; loc: LngLat; fill: string; stroke?: string; r?: number; title?: string }
export interface MapPin { id: string; loc: LngLat; label: string; cls?: string }

interface Props {
  height: number;
  zones?: LngLat[][][];
  lines?: MapLine[];
  dots?: MapDot[];
  pins?: MapPin[];
  fit: LngLat[];
  onDot?: (id: string) => void;
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export function LiveMap({ height, zones = [], lines = [], dots = [], pins = [], fit, onDot }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const markers = useRef(new Map<string, Marker>());
  const props = useRef({ zones, lines, dots, pins, onDot });
  props.current = { zones, lines, dots, pins, onDot };

  const draw = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = props.current;
    (m.getSource("z") as maplibregl.GeoJSONSource).setData(fc(p.zones.map((rings) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: rings } }))));
    (m.getSource("l") as maplibregl.GeoJSONSource).setData(fc(p.lines.map((l) => ({
      type: "Feature", properties: { color: l.color, w: l.width ?? 4, dash: !!l.dashed }, geometry: { type: "LineString", coordinates: l.coords },
    }))));
    (m.getSource("d") as maplibregl.GeoJSONSource).setData(fc(p.dots.map((d) => ({
      type: "Feature", properties: { id: d.id, fill: d.fill, stroke: d.stroke ?? "#ffffff", r: d.r ?? 6, title: d.title ?? "" }, geometry: { type: "Point", coordinates: d.loc },
    }))));
    const seen = new Set<string>();
    for (const pin of p.pins) {
      seen.add(pin.id);
      let mk = markers.current.get(pin.id);
      if (!mk) {
        const wrap = document.createElement("div");
        wrap.className = "mkwrap";
        const dot = document.createElement("div");
        dot.className = `mk ${pin.cls ?? ""}`;
        const lab = document.createElement("span");
        lab.className = "mk-label";
        wrap.append(dot, lab);
        mk = new maplibregl.Marker({ element: wrap, anchor: "top", offset: [0, -11] }).setLngLat(pin.loc).addTo(m);
        markers.current.set(pin.id, mk);
      }
      mk.setLngLat(pin.loc);
      const [dot, lab] = mk.getElement().children as unknown as HTMLElement[];
      dot.className = `mk ${pin.cls ?? ""}`;
      lab.textContent = pin.label;
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }
  };

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-95.33, 29.75], zoom: 11, attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.current = m;
    m.on("load", () => {
      m.addSource("z", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "z", type: "line", source: "z", paint: { "line-color": "#1F6E5A", "line-width": 1.5, "line-dasharray": [2, 3], "line-opacity": 0.7 } });
      m.addSource("l", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "l", type: "line", source: "l", filter: ["!", ["get", "dash"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-opacity": 0.85 } });
      m.addLayer({ id: "ld", type: "line", source: "l", filter: ["get", "dash"], paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-dasharray": [1.5, 1.5], "line-opacity": 0.8 } });
      m.addSource("d", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "d", type: "circle", source: "d", paint: { "circle-color": ["get", "fill"], "circle-radius": ["get", "r"], "circle-stroke-color": ["get", "stroke"], "circle-stroke-width": 2.5 } });
      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      m.on("mousemove", "d", (e) => {
        const f = e.features?.[0];
        if (!f?.properties?.title) return;
        m.getCanvas().style.cursor = "pointer";
        pop.setLngLat((f.geometry as GeoJSON.Point).coordinates as LngLat).setText(String(f.properties.title)).addTo(m);
      });
      m.on("mouseleave", "d", () => { m.getCanvas().style.cursor = ""; pop.remove(); });
      m.on("click", "d", (e) => { const id = e.features?.[0]?.properties?.id; if (id) props.current.onDot?.(String(id)); });
      ready.current = true;
      draw();
    });
    return () => { ready.current = false; markers.current.clear(); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw);

  const fitKey = fit.map((p) => p.join()).join("|");
  useEffect(() => {
    const m = map.current;
    if (!m || !fit.length) return;
    const xs = fit.map((p) => p[0]), ys = fit.map((p) => p[1]);
    const go = () => m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 40, maxZoom: 15, duration: 0 });
    if (m.loaded()) go(); else m.once("load", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={el} className="wcmap livemap" style={{ height }} />;
}
