import { useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import { type CorridorStat, roadCorridorTotals, segmentFeatures, useData } from "../lib/data";
import { bboxOf, lineParts, type LngLat } from "../lib/geo";
import { pct } from "../lib/format";
import { COLORS, FitTo, MapBase, MapLegend } from "../components/MapBase";
import { Caveats, DataVintage } from "../components/Notes";

type SortKey = "pointsNewlyCrossed" | "pedCrashes" | "pedDeaths" | "name";

export default function Corridors() {
  const d = useData();
  const { corridors, totals, zones } = d;
  const [sort, setSort] = useState<SortKey>("pointsNewlyCrossed");
  const [sel, setSel] = useState<string | null>(null);

  const rows = useMemo(() => {
    const r = [...corridors];
    r.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (b[sort] as number) - (a[sort] as number)));
    return r;
  }, [corridors, sort]);

  const selected = corridors.find((c) => c.key === sel);
  const feats = (c: CorridorStat) => segmentFeatures(d, c.segments).map((f, i) => ({ ...f, properties: { ...f.properties, _layer: c.segments[i].layer } }));
  const selectedFeats = selected ? feats(selected) : [];
  const fit: LngLat[] = selected
    ? (() => { const b = bboxOf(selectedFeats.flatMap((f) => lineParts(f.geometry))); return [[b[0], b[1]], [b[2], b[3]]] as LngLat[]; })()
    : zones.flatMap((z) => z.rings[0]);
  const color = { rail: COLORS.rail, pedHin: COLORS.ped, hin: COLORS.hin } as const;

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th aria-sort={sort === k ? "descending" : "none"}>
      <button type="button" className="sort" onClick={() => setSort(k)}>{children}{sort === k ? " ▾" : ""}</button>
    </th>
  );

  return (
    <div className="page">
      <h1>The corridors now between children and school</h1>
      <p className="lede">
        Each road or railroad that a 2026–27 straight-line walk crosses but the 2025–26 walk did not, ranked by how much of the
        closed-zone area now has to cross it. The City can act on this list whatever HISD decides about buses: crossings,
        signals, crossing guards, sidewalks.
      </p>

      <div className="split corridor-split">
        <div className="table-scroll">
          <table className="data selectable">
            <thead>
              <tr>
                <Th k="name">Road or track</Th>
                <th>Listed as</th>
                <Th k="pointsNewlyCrossed">Area newly crossing</Th>
                <th>Closed zones</th>
                <Th k="pedCrashes">Ped. crashes*</Th>
                <Th k="pedDeaths">Ped. deaths*</Th>
                <th>Whole road on City list</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const whole = c.kind === "road" ? roadCorridorTotals(d, c.name) : null;
                return (
                  <tr key={c.key} className={c.key === sel ? "selected" : ""} onClick={() => setSel(c.key === sel ? null : c.key)}
                    tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(c.key === sel ? null : c.key)}>
                    <th scope="row">{c.name}</th>
                    <td className="small">{[c.kind === "rail" && "Railroad", c.pedDangerous && "Ped-dangerous", c.highInjury && "HIN"].filter(Boolean).join(", ")}</td>
                    <td>{pct((100 * c.pointsNewlyCrossed) / totals.points)} <span className="muted small">({c.pointsNewlyCrossed} pts)</span></td>
                    <td className="small">{c.zones.map((z) => z.replace(" ES", "")).join(", ")}</td>
                    <td>{c.kind === "road" ? c.pedCrashes : "n/a"}</td>
                    <td>{c.kind === "road" ? c.pedDeaths : "n/a"}</td>
                    <td className="small">{whole ? `${whole.pedCrashes} crashes, ${whole.pedDeaths} deaths over ${whole.miles.toFixed(1)} mi` : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small muted">* Pedestrian crashes and deaths on the specific segments these walks cross (City HIN 2022). Select a row to show it on the map above.</p>
        </div>
        <div className="mapwrap">
          <MapBase className="map">
            {zones.map((z) => (
              <GeoJSON key={z.nbr} data={{ type: "Polygon", coordinates: z.rings } as any} style={{ color: COLORS.zone, weight: 1.5, fillOpacity: 0.08 }} interactive={false} />
            ))}
            {selected && (
              <GeoJSON key={selected.key} data={{ type: "FeatureCollection", features: selectedFeats } as any}
                style={(f) => ({ color: color[f?.properties._layer as keyof typeof color], weight: 8, opacity: 0.9 })} />
            )}
            <FitTo points={fit} maxZoom={15} />
          </MapBase>
          <MapLegend />
        </div>
      </div>
      <Caveats area />
      <DataVintage />
    </div>
  );
}
