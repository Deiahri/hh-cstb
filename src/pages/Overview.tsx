import { useEffect } from "react";
import { GeoJSON, Tooltip } from "react-leaflet";
import { Link, useLocation } from "react-router-dom";
import { useData } from "../lib/data";
import { pct, signedMi } from "../lib/format";
import { FitTo, MapBase, MapLegend } from "../components/MapBase";
import { Caveats, DataVintage } from "../components/Notes";
import { NOT_PUBLISHED, ShuttleLayer, shuttlePoints } from "../components/ShuttleLayer";
import { PickupCards } from "../components/PickupCards";

// Sequential teal→red ramp for "share of zone whose new walk crosses a hazard".
function ramp(p: number) {
  const stops = ["#fde68a", "#f59e0b", "#dc2626", "#7f1d1d"];
  return stops[Math.min(stops.length - 1, Math.floor((p / 100) * stops.length))];
}

function Shift({ from, to }: { from: number; to: number }) {
  return (
    <span className="shift">
      {pct(from)} <span aria-hidden>→</span><span className="sr-only">to</span> <strong>{pct(to)}</strong>
    </span>
  );
}

export default function Overview() {
  const { zones, totals, shuttles } = useData();
  const ross = zones.find((z) => z.name.startsWith("Ross"));
  const rossDiffers = ross && !ross.receiving.some((r) => /Martinez/i.test(r.name));
  // The April 15 page links here with { scrollTo: "pickups" }.
  const location = useLocation();
  const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
  useEffect(() => {
    if (scrollTo) document.getElementById(scrollTo)?.scrollIntoView({ block: "start" });
  }, [scrollTo]);

  return (
    <div className="page">
      <h1>Seven closed zones: the walk got longer, and it got more dangerous</h1>
      <p className="lede">
        Each 2025–26 elementary zone that has no 2026–27 counterpart was sampled on a {totals.spacingM} m grid
        ({totals.points.toLocaleString()} points). Each point was measured in a straight line to its old school and to its new one.
      </p>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-num">{pct(totals.pctOver2New)}</div>
          <div className="kpi-label">of the closed-zone area is 2+ miles from its new school, the distance that earns a bus</div>
        </div>
        <div className="kpi alert">
          <div className="kpi-num">{pct(totals.hazardNew.combined)}</div>
          <div className="kpi-label">now crosses a pedestrian-dangerous road or active railroad on the way to school, up from {pct(totals.hazardOld.combined)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{pct(totals.hazardNew.rail)}</div>
          <div className="kpi-label">crosses active railroad track, up from {pct(totals.hazardOld.rail)}</div>
        </div>
      </div>

      <div className="split overview-split">
        <div className="mapwrap">
          <MapBase className="map">
            {zones.map((z) => (
              <GeoJSON
                key={z.nbr}
                data={{ type: "Polygon", coordinates: z.rings } as any}
                style={{ color: "#111", weight: 1.5, fillColor: ramp(z.hazardNew.combined), fillOpacity: 0.55 }}
              >
                <Tooltip sticky>{z.name}: {pct(z.hazardNew.combined)} crosses a hazard (was {pct(z.hazardOld.combined)})</Tooltip>
              </GeoJSON>
            ))}
            <ShuttleLayer shuttles={shuttles.shuttles} />
            <FitTo points={[...zones.flatMap((z) => z.rings[0]), ...shuttlePoints(shuttles.shuttles)]} maxZoom={13} />
          </MapBase>
          <p className="small muted">
            Fill: share of the zone whose new walk crosses a hazard. Bus pin: shuttle pickup at the closed or moved campus.
            Yellow outline: that campus's grounds (OpenStreetMap), where the stop is somewhere. Blue dot: drop-off campus.
          </p>
          <MapLegend shuttle />
        </div>
      </div>

      <div className="table-scroll">
        <table className="data stack">
          <caption>Per closed zone. All percentages are shares of zone area.</caption>
          <thead>
            <tr>
              <th>Closed zone</th><th>Now zoned to</th><th>Median change</th><th>Farther</th><th>2+ mi</th>
              <th>Ped-dangerous road</th><th>Any High Injury road</th><th>Active railroad</th><th>Either hazard</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.nbr}>
                <th scope="row">{z.name}</th>
                <td data-label="Now zoned to">{z.receiving.map((r) => `${r.name}${z.receiving.length > 1 ? ` (${r.share.toFixed(0)}%)` : ""}`).join(", ")}</td>
                <td data-label="Median change">{signedMi(z.medianDeltaM)}</td>
                <td data-label="Farther">{pct(z.pctFarther)}</td>
                <td data-label="2+ mi">{pct(z.pctOver2New)}</td>
                <td data-label="Ped-dangerous road"><Shift from={z.hazardOld.ped} to={z.hazardNew.ped} /></td>
                <td data-label="Any High Injury road"><Shift from={z.hazardOld.hin} to={z.hazardNew.hin} /></td>
                <td data-label="Active railroad"><Shift from={z.hazardOld.rail} to={z.hazardNew.rail} /></td>
                <td data-label="Either hazard"><Shift from={z.hazardOld.combined} to={z.hazardNew.combined} /></td>
              </tr>
            ))}
            <tr className="total">
              <th scope="row">All seven</th><td /><td /><td /><td data-label="2+ mi">{pct(totals.pctOver2New)}</td>
              <td data-label="Ped-dangerous road"><Shift from={totals.hazardOld.ped} to={totals.hazardNew.ped} /></td>
              <td data-label="Any High Injury road"><Shift from={totals.hazardOld.hin} to={totals.hazardNew.hin} /></td>
              <td data-label="Active railroad"><Shift from={totals.hazardOld.rail} to={totals.hazardNew.rail} /></td>
              <td data-label="Either hazard"><Shift from={totals.hazardOld.combined} to={totals.hazardNew.combined} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="shuttles">
        <h2>Where the closure shuttles stop</h2>
        <p>
          HISD runs a direct shuttle "from their current campus to their receiving school site" for 2026–27 and 2027–28, open to any
          K-12 student affected by a closure. The table places each one on HISD's campus points. {NOT_PUBLISHED} HISD said route details would be
          shared with families in early August.
        </p>
        <section id="pickups">
          <h3>The seven pickup sites</h3>
          <p className="small">
            Each closed elementary building is now a daily pickup for two school years. HISD owns the building and the bus. The City owns
            the streets, the school zones and the crossing-guard funding. The "not public" rows show where one side's answer is needed
            and isn't published. The zones on the new walks are on the <Link to="/april-15">Before April 15</Link> page.
          </p>
          <PickupCards />
        </section>
        <div className="table-scroll">
          <table className="data">
            <caption>All {shuttles.shuttles.length} campuses on HISD's closure list. Distances are straight lines between campus points.</caption>
            <thead>
              <tr><th>Pickup (closed or moved campus)</th><th>Drop-off</th><th>Straight line</th><th>Note</th></tr>
            </thead>
            <tbody>
              {shuttles.shuttles.map((s) => (
                <tr key={s.from.nbr}>
                  <th scope="row">{s.from.name}<div className="small muted">{s.from.address}</div></th>
                  <td>
                    {s.to.map((t) => (
                      <div key={t.nbr + t.name}>{t.name}{t.grades && <> ({t.grades})</>}<div className="small muted">{t.address}</div></div>
                    ))}
                  </td>
                  <td>{s.sameSite ? "Same building" : s.to.map((t) => `${t.miles.toFixed(2)} mi`).join(" / ")}</td>
                  <td className="small">{s.sameSite ? "No shuttle trip. " : ""}{s.flags.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Pairings: {shuttles.sources.map((src, i) => <span key={src.url}>{i > 0 && "; "}<a href={src.url} target="_blank" rel="noreferrer">{src.label}</a></span>)}.
          Families can ask HISD's closure family line, 713-556-7121, or the campus office for their exact stop.
        </p>
      </section>

      {rossDiffers && ross && (
        <p className="note">
          <strong>Ross ES.</strong> News coverage of the closure vote paired Ross with Roosevelt ES or C. Martinez ES. HISD's published 2026–27
          boundary layer assigns the former Ross area to {ross.receiving.map((r) => `${r.name} (${r.share.toFixed(0)}%)`).join(" and ")}. This page
          follows the boundary layer. Families should confirm with the district.
        </p>
      )}
      <Caveats area />
      <DataVintage />
    </div>
  );
}
