import { useMemo, useState } from "react";
import { CircleMarker, GeoJSON, Tooltip } from "react-leaflet";
import { type CorridorStat, roadCorridorTotals, segmentFeatures, useData } from "../lib/data";
import { NEAR_M, zonePossible } from "../lib/crossings";
import { bboxOf, lineParts, type LngLat } from "../lib/geo";
import { dist, pct } from "../lib/format";
import { DICTS } from "../lib/i18n";
import { COLORS, FitTo, MapBase, MapLegend } from "../components/MapBase";
import { Caveats, DataVintage, DatesLine } from "../components/Notes";

type SortKey = "control" | "pointsNewlyCrossed" | "pedCrashes" | "pedDeaths" | "name";

// The page is for City and HISD staff, in English.
const RAIL_KINDS = DICTS.en.cross.railKinds;
const ft = (m: number) => dist(m, "en");
const STATUS_ORDER = { none: 0, far: 1, near: 2 } as const;
// HPW's next school-zone deadline: zones for 2027–28, the shuttle's last year.
const NEXT_ZONE_DEADLINE = "April 15, 2027";

const schools = (c: CorridorStat) => c.receiving.join(" or ");

/** Is a City school zone even possible here? HPW: a City-owned thoroughfare or collector, or a street bordering the school. */
function zoneOption(c: CorridorStat): string {
  const who = `the principal of ${schools(c)} applies by ${NEXT_ZONE_DEADLINE}`;
  if (c.streetClass === undefined || c.streetClass === null)
    return `School zone, only if the street is a City thoroughfare or collector or borders the school (HPW): ${who}`;
  const borders = c.bordersSchool ?? [];
  if (zonePossible(c)) return `School zone: ${who}`;
  if (borders.length > 0)
    return `School zone: the street borders ${borders.join(" and ")}, but HPW requires a City-owned street (this one is ${c.streetClass.owner})`;
  const cls = c.streetClass.type ?? "a local street, not on the City's thoroughfare plan";
  return `No school zone under HPW's rules (${cls}${c.streetClass.owner && c.streetClass.owner !== "COH" ? `, owned by ${c.streetClass.owner}` : ""}; doesn't border the school)`;
}

/** What the City (or HISD, for rail) can do where the walks cross with nothing controlled nearby. */
function options(c: CorridorStat): string[] {
  if (c.kind === "rail")
    return [
      "HISD: a bus stop on the home side of the tracks",
      `City: a sidewalk to, and a guard at, the nearest public crossing${c.control.nearest && c.control.status !== "none" ? ` (${c.control.nearest})` : ""}`,
    ];
  return [
    "Crossing guard: the City decides how many, on schools' recommendations (Tex. Local Gov't Code §343.014)",
    zoneOption(c),
    "Crosswalk or signal study: report through 311",
  ];
}

function ControlCell({ c }: { c: CorridorStat }) {
  const k = c.control, what = c.kind === "road" ? "traffic light" : "public rail crossing";
  if (k.status === "none")
    return <><span className="status none">No</span> <span className="small">No {what} within {ft(500)} of where the walks cross.</span></>;
  const detail = `${pct(k.within250Pct)} of crossings have one within ${ft(NEAR_M)}; median ${k.medianM === null ? "n/a" : ft(k.medianM)}${k.nearest ? `. Most often nearest: ${k.nearest}` : ""}.`;
  return k.status === "far"
    ? <><span className="status far">Mostly no</span> <span className="small">{detail}</span></>
    : <><span className="status near">Yes</span> <span className="small">{detail}</span></>;
}

export default function Corridors() {
  const d = useData();
  const { corridors, totals, zones } = d;
  const [sort, setSort] = useState<SortKey>("control");
  const [sel, setSel] = useState<string | null>(null);
  const [both, setBoth] = useState(false);

  const rows = useMemo(() => {
    const r = corridors.filter((c) => both || c.pointsNewlyCrossed > 0);
    r.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "control"
        ? STATUS_ORDER[a.control.status] - STATUS_ORDER[b.control.status] || a.control.within250Pct - b.control.within250Pct ||
          b.pointsNewlyCrossed - a.pointsNewlyCrossed || b.pointsNewRoute - a.pointsNewRoute
        : (b[sort] as number) - (a[sort] as number));
    return r;
  }, [corridors, sort, both]);

  const selected = corridors.find((c) => c.key === sel);
  const feats = (c: CorridorStat) => segmentFeatures(d, c.segments).map((f, i) => ({ ...f, properties: { ...f.properties, _layer: c.segments[i].layer } }));
  const selectedFeats = selected ? feats(selected) : [];
  const fit: LngLat[] = selected
    ? (() => { const b = bboxOf(selectedFeats.flatMap((f) => lineParts(f.geometry))); return [[b[0], b[1]], [b[2], b[3]]] as LngLat[]; })()
    : zones.flatMap((z) => z.rings[0]);
  const color = { rail: COLORS.rail, pedHin: COLORS.ped, hin: COLORS.hin } as const;
  const uncontrolled = corridors.filter((c) => c.pointsNewlyCrossed > 0 && c.control.status !== "near");

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th aria-sort={sort === k ? "descending" : "none"}>
      <button type="button" className="sort" onClick={() => setSort(k)}>{children}{sort === k ? " ▾" : ""}</button>
    </th>
  );

  return (
    <div className="page">
      <h1>The corridors now between children and school</h1>
      <p className="lede">
        Each road or railroad that a 2026–27 straight-line walk crosses but the 2025–26 walk did not. It's sorted so the
        places with <strong>no traffic light or public rail crossing nearby</strong> come first ({uncontrolled.length} of them),
        each with what the City can do there: crossing guards, school zones, signals, crosswalks, sidewalks. The City can act on
        this list whatever HISD decides about buses.
      </p>
      <label className="small toggle">
        <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} /> Also show roads and tracks the walk to
        the old campus crosses too (not new, but still on today's walks)
      </label>

      <div className="split corridor-split">
        <div className="table-scroll">
          <table className="data selectable corridors">
            <thead>
              <tr>
                <Th k="name">Road or track</Th>
                <Th k="control">Traffic light or public rail crossing nearby?</Th>
                <th>What can change it</th>
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
                const onBoth = c.pointsNewRoute - c.pointsNewlyCrossed;
                return (
                  <tr key={c.key} className={`${c.key === sel ? "selected" : ""} ${c.pointsNewlyCrossed === 0 ? "not-new" : ""}`}
                    onClick={() => setSel(c.key === sel ? null : c.key)}
                    tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(c.key === sel ? null : c.key)}>
                    <th scope="row">
                      {c.name}
                      <div className="small muted">{[c.kind === "rail" && "Railroad", c.pedDangerous && "Ped-dangerous", c.highInjury && "HIN"].filter(Boolean).join(", ")}</div>
                    </th>
                    <td className="control-cell"><ControlCell c={c} /></td>
                    <td className="small">
                      {c.control.status !== "near" && <ul className="options">{options(c).map((o) => <li key={o}>{o}</li>)}</ul>}
                    </td>
                    <td>
                      {c.pointsNewlyCrossed > 0
                        ? <>{pct((100 * c.pointsNewlyCrossed) / totals.points)} <span className="muted small">({c.pointsNewlyCrossed} pts)</span></>
                        : <span className="small">Not new: all {c.pointsNewRoute} pts cross it on both walks</span>}
                      {c.pointsNewlyCrossed > 0 && onBoth > 0 && <div className="small muted">+{onBoth} pts crossing it on both walks</div>}
                    </td>
                    <td className="small">{c.zones.map((z) => z.replace(" ES", "")).join(", ")}</td>
                    <td>{c.kind === "road" ? c.pedCrashes : "n/a"}</td>
                    <td>{c.kind === "road" ? c.pedDeaths : "n/a"}</td>
                    <td className="small">{whole ? `${whole.pedCrashes} crashes, ${whole.pedDeaths} deaths over ${whole.miles.toFixed(1)} mi` : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small muted">
            * Pedestrian crashes and deaths on the specific segments these walks cross (City HIN 2022). "Nearby" is measured from where
            each straight-line walk crosses the road or track: within {ft(NEAR_M)} for most crossings. Traffic lights only: crossing
            guards, stop signs and marked crosswalks aren't in any public Houston layer, so a guarded crossing shows as "No." Rail rows
            are split by closed zone. Select a row to show it on the map, with the lights or public crossings within {ft(500)}.
          </p>
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
            {selected?.controls.map((x) => (
              <CircleMarker key={`${x.loc}`} center={[x.loc[1], x.loc[0]]} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS.plan, fillOpacity: 1 }}>
                <Tooltip>{x.kind === "signal" ? `Traffic light: ${x.label}` : `Public rail crossing: ${x.label}${x.railKind ? ` (${RAIL_KINDS[x.railKind]})` : ""}`}</Tooltip>
              </CircleMarker>
            ))}
            <FitTo points={fit} maxZoom={15} />
          </MapBase>
          <MapLegend />
        </div>
      </div>
      <Caveats area />
      <DatesLine />
      <DataVintage />
    </div>
  );
}
