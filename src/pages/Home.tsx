import { useState } from "react";
import { GeoJSON, useMapEvents } from "react-leaflet";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { analyzeAddress } from "../lib/analyze";
import { useData } from "../lib/data";
import { type Candidate, geocode, reverseGeocode } from "../lib/geocode";
import { type LngLat, pointInRings } from "../lib/geo";
import { useT } from "../lib/i18n";
import { walkQuery } from "../lib/walk";
import { COLORS, FitTo, MapBase } from "../components/MapBase";
import { Caveats, DataVintage } from "../components/Notes";

function ClickToSet({ onPick }: { onPick: (p: LngLat) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lng, e.latlng.lat]) });
  return null;
}

/** A point inside each closed zone for the demo shortcuts: the vertex average, nudged inside if needed. */
function zoneSamplePoint(rings: LngLat[][]): LngLat {
  const outer = rings[0];
  const c: LngLat = [outer.reduce((a, p) => a + p[0], 0) / outer.length, outer.reduce((a, p) => a + p[1], 0) / outer.length];
  if (pointInRings(c, rings)) return c;
  return outer[Math.floor(outer.length / 2)];
}

export const schoolName = (s: string) => s.replace(/ NQ ES$| ES$/, "");

/** Step one: the address. A closed-zone home goes on to the Pre-K question; any other goes straight to its walk. */
export default function Home() {
  const d = useData();
  const { t } = useT();
  const w = t.wc, tl = t.lookup;
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<"noMatch" | "searchDown" | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [mapOpen, setMapOpen] = useState(false);

  // Links shared before the redesign put the address on the home page: send them to the walk.
  if (params.has("lat") && params.has("lng")) return <Navigate to={`/walk?${params}`} replace />;

  const go = (p: LngLat, label: string) => {
    const r = analyzeAddress(p, d.ds);
    nav(`/${r.closedZone ? "prek" : "walk"}?${walkQuery(p, label)}`);
  };

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    setCands([]);
    try {
      const found = await geocode(/houston/i.test(q) ? q : `${q}, Houston, TX`);
      if (!found.length) setErr("noMatch");
      else if (found.length === 1 || found[0].score >= 98) go(found[0].loc, found[0].address);
      else setCands(found);
    } catch {
      setErr("searchDown");
      setMapOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function onMapPick(p: LngLat) {
    setBusy(true);
    const label = await reverseGeocode(p);
    setBusy(false);
    go(p, label ?? `${p[1].toFixed(5)}, ${p[0].toFixed(5)}`);
  }

  const pairs = d.zones.map((z) => ({ z, to: z.receiving.map((r) => schoolName(r.name)).join(" / ") }));

  return (
    <section className="screen">
      <div className="hero">
        <div style={{ display: "grid", gap: 14 }}>
          <h1>{w.h1}</h1>
          <p className="lede-wc">{w.lede}</p>
        </div>
        <form className="form" onSubmit={onSearch} role="search">
          <div className="field">
            <label className="label" htmlFor="addr">{w.addr}</label>
            <input className="input" id="addr" value={q} onChange={(e) => setQ(e.target.value)} placeholder={w.addrPlaceholder} autoComplete="street-address" />
          </div>
          <button className="btn" type="submit" disabled={busy}>{busy ? tl.searching : w.check}</button>
          {err && <p className="error" role="alert">{tl[err]}</p>}
          {cands.length > 0 && (
            <ul className="cands">
              {cands.map((c) => (
                <li key={c.address}><button type="button" className="list-row" style={{ width: "100%", font: "inherit", cursor: "pointer" }} onClick={() => go(c.loc, c.address)}>
                  <span>{c.address}</span><span>›</span>
                </button></li>
              ))}
            </ul>
          )}
          <button type="button" className="linkbtn" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}>{mapOpen ? w.hideMap : w.pickMap}</button>
          {mapOpen && (
            <div className="walk-map">
              <p className="small muted">{w.mapHint}</p>
              <MapBase>
                <ClickToSet onPick={onMapPick} />
                {d.zones.map((z) => (
                  <GeoJSON key={z.nbr} data={{ type: "Polygon", coordinates: z.rings } as any} style={{ color: COLORS.zone, weight: 2, fillOpacity: 0.12 }} interactive={false} />
                ))}
                <FitTo points={d.zones.flatMap((z) => z.rings[0])} />
              </MapBase>
            </div>
          )}
          <div className="chips">
            <span className="small muted">{w.tryZone}</span>
            {d.zones.map((z) => (
              <button key={z.nbr} type="button" className="chip" onClick={() => go(z.demoPoint ?? zoneSamplePoint(z.rings), tl.samplePoint(schoolName(z.name)))}>
                {schoolName(z.name)}
              </button>
            ))}
          </div>
        </form>
      </div>

      <h2>{w.closed}</h2>
      <div className="list grid4">
        {pairs.map(({ z, to }) => (
          <Link key={z.nbr} className="list-row" to={`/schools/${z.nbr}`}><span>{w.pair(schoolName(z.name), to)}</span><span>{w.see} ›</span></Link>
        ))}
      </div>
      <Caveats />
      <DataVintage />
    </section>
  );
}
