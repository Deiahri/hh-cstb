import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleMarker, GeoJSON, Marker, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import { analyzeAddress, type AddressResult, type Hazard, type RouteResult } from "../lib/analyze";
import { segmentFeatures, shuttleFrom, useData, type AppData, type ShuttleStat } from "../lib/data";
import { type Candidate, geocode, reverseGeocode } from "../lib/geocode";
import { type LngLat, METERS_PER_MILE, pointInRings } from "../lib/geo";
import { coord, mi } from "../lib/format";
import { dataText, shareUrl, useT } from "../lib/i18n";
import { COLORS, FitTo, MapBase, MapLegend, pinIcon } from "../components/MapBase";
import { HazardList, hazardName } from "../components/HazardList";
import { Caveats, DataVintage } from "../components/Notes";
import { ShuttleLayer, shuttlePoints } from "../components/ShuttleLayer";

const ll = ([x, y]: LngLat) => [y, x] as [number, number];

/** What the one-line answer counts: any active railroad, and how many distinct listed roads. */
export const crossCounts = (hz: Hazard[]) => ({ rail: hz.some((h) => h.kind === "rail"), roads: hz.filter((h) => h.kind === "road").length });

/**
 * The walk to the closure shuttle's pickup, while the shuttle runs (2026–27 and 2027–28). The pickup is the
 * 2025–26 campus, so it's the same straight line as the walk to last year's school.
 */
export const shuttleWalk = (r: AddressResult, s?: ShuttleStat) => (s && !s.sameSite && r.old ? r.old : undefined);

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

export function RouteLayers({ d, r, stop, shuttle }: { d: AppData; r: AddressResult; stop?: LngLat; shuttle?: ShuttleStat }) {
  const { t } = useT();
  const crossedNew = r.now ? r.now.hazards.flatMap((h) => h.lineIds) : [];
  const crossedOld = r.old ? r.old.hazards.flatMap((h) => h.lineIds) : [];
  const seen = new Set<string>();
  const segs = [...crossedNew, ...crossedOld].filter((s) => !seen.has(`${s.layer}${s.id}`) && seen.add(`${s.layer}${s.id}`));
  const feats = segmentFeatures(d, segs).map((f, i) => ({ ...f, properties: { ...f.properties, _layer: segs[i].layer } }));
  const color = { rail: COLORS.rail, pedHin: COLORS.ped, hin: COLORS.hin } as const;
  // Crossing points on both walks: the old line is the walk to the shuttle pickup while the shuttle runs.
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
      {r.old && <Polyline positions={[ll(r.point), ll(r.old.school.loc)]} pathOptions={{ color: COLORS.oldRoute, weight: 3, dashArray: "6 6" }} />}
      {r.now && <Polyline positions={[ll(r.point), ll(r.now.school.loc)]} pathOptions={{ color: COLORS.newRoute, weight: 4 }} />}
      {marks.map((h) => (
        <CircleMarker key={`${h.key}@${h.at.join()}`} center={ll(h.at)} radius={6} pathOptions={{ color: "#111", weight: 2, fillColor: "#fff", fillOpacity: 1 }}>
          <Tooltip>{hazardName(h, t)}</Tooltip>
        </CircleMarker>
      ))}
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

/** One walk, answer first: what it crosses, then how far, then the per-road detail on request. */
function Walk({ title, when, route }: { title: string; when?: string; route: RouteResult }) {
  const { t } = useT();
  const c = crossCounts(route.hazards);
  return (
    <div className="walk">
      <h3 className="walk-title">{title}</h3>
      {when && <p className="walk-when">{when}</p>}
      <p className="walk-answer">
        <strong>{t.result.crosses(c.rail, c.roads)}</strong> <span className="muted">({t.result.miles(mi(route.distance))})</span>
      </p>
      {route.hazards.length > 0 && (
        <details className="walk-details">
          <summary>{t.result.details}</summary>
          <HazardList hazards={route.hazards} />
        </details>
      )}
    </div>
  );
}

function ShuttleNote({ s }: { s: ShuttleStat }) {
  const { lang, t } = useT();
  const dest = s.to.map((x) => (x.grades ? `${x.name} (${dataText(lang, x.grades)})` : x.name)).join(t.result.and);
  return (
    <div className="note shuttle">
      <p><strong>{t.result.shuttleTitle}.</strong> {t.result.shuttleBody(s.from.name, s.from.address, dest)}</p>
      <p>{t.result.notPublished}</p>
      {s.flags.length > 0 && <p className="small">{s.flags.map((f) => dataText(lang, f)).join(" ")}</p>}
    </div>
  );
}

function Result({ r, addr, stop, onResetStop, shuttle }: { r: AddressResult; addr: string; stop: LngLat; onResetStop: () => void; shuttle?: ShuttleStat }) {
  const { lang, t } = useT();
  const tr = t.result;
  if (!r.oldZone && !r.newZone)
    return <div className="card"><p>{tr.outside}</p></div>;

  const packetParams = new URLSearchParams({
    lat: String(r.point[1]), lng: String(r.point[0]), slat: String(stop[1]), slng: String(stop[0]), addr,
  });
  const now = r.now;
  const sw = shuttleWalk(r, shuttle);
  const nowName = now?.school.name ?? r.newZone?.Campus_Short_Name ?? "";
  const oldName = r.old?.school.name ?? r.oldZone?.Campus_Short_Name ?? "";
  const nowCounts = crossCounts(now?.hazards ?? []);
  const railOld = !!sw && crossCounts(sw.hazards).rail;
  const beyond2 = !!now && now.distance >= 2 * METERS_PER_MILE;
  const smsText = now ? tr.smsBody(addr || coord(r.point), nowName, tr.crosses(nowCounts.rail, nowCounts.roads), shareUrl(lang)) : "";

  return (
    <div className="card result">
      <p className="headline">
        {r.closedZone
          ? tr.headlineClosed(oldName, nowName)
          : <>{tr.headlineOpen(nowName)}{r.old && now && r.old.school.nbr !== now.school.nbr && tr.wasLastYear(r.old.school.name)}</>}
      </p>

      {now && (
        <div className="walks">
          {sw && <Walk title={tr.walkShuttle(oldName)} when={tr.walkShuttleWhen} route={sw} />}
          <Walk title={sw ? tr.walkDirect(nowName) : tr.walkOnly(nowName)} when={sw ? tr.walkDirectWhen : undefined} route={now} />
          {sw && railOld !== nowCounts.rail && (
            <p className="note rail">{railOld ? tr.shuttleAddsRail(nowName) : tr.shuttleAvoidsRail(nowName)}</p>
          )}
        </div>
      )}

      {now && (
        <p className={beyond2 ? "note good" : "note"}>
          <strong>{!beyond2 && sw ? tr.cliffLabel : tr.distanceLabel}:</strong>{" "}
          {beyond2 ? tr.over2(mi(now.distance), nowName) : sw ? tr.cliff(mi(now.distance), nowName) : tr.under2(mi(now.distance), nowName)}
        </p>
      )}

      {shuttle && !shuttle.sameSite && <ShuttleNote s={shuttle} />}
      {sw && <p className="note"><strong>{tr.preKLabel}:</strong> {tr.preK}</p>}
      {(nowCounts.rail || railOld) && <p className="note rail"><strong>{tr.railLabel}:</strong> {tr.railNote}</p>}

      <h3>{tr.stopTitle}</h3>
      <p className="small">
        {tr.stopBody}{" "}
        <button type="button" className="linkish" onClick={onResetStop}>{tr.resetStop}</button>
      </p>

      <div className="actions">
        <Link className="button primary" to={`/packet?${packetParams}`}>{tr.packetButton}</Link>
        {now && <a className="button" href={`sms:?&body=${encodeURIComponent(smsText)}`}>{tr.sms}</a>}
      </div>
    </div>
  );
}

export default function Lookup() {
  const d = useData();
  const { t } = useT();
  const tl = t.lookup;
  const [params, setParams] = useSearchParams();
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  const home: LngLat | null = params.get("lat") && params.get("lng") ? [lng, lat] : null;
  const addr = params.get("addr") ?? "";
  const stop: LngLat | null = params.get("slat") ? [Number(params.get("slng")), Number(params.get("slat"))] : home;

  const [q, setQ] = useState(addr);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<"noMatch" | "searchDown" | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  // Phones: the map starts folded away so the address box and the answer come first.
  const [mapOpen, setMapOpen] = useState(false);
  const mapRef = useRef<HTMLElement>(null);

  const result = useMemo(() => (home ? analyzeAddress(home, d.ds) : null), [home?.[0], home?.[1], d.ds]);
  // The shuttle leaving this address's 2025–26 campus, when that campus closed or moved.
  const shuttle = result?.oldZone ? shuttleFrom(d, Number(result.oldZone.Campus__Number)) : undefined;

  const setHome = (p: LngLat, label: string) => {
    setParams({ lat: p[1].toFixed(6), lng: p[0].toFixed(6), addr: label });
    setQ(label);
    setCands([]);
  };
  const setStop = (p: LngLat) => {
    const next = new URLSearchParams(params);
    next.set("slat", p[1].toFixed(6));
    next.set("slng", p[0].toFixed(6));
    setParams(next, { replace: true });
  };
  const resetStop = () => {
    const next = new URLSearchParams(params);
    next.delete("slat");
    next.delete("slng");
    setParams(next, { replace: true });
  };
  const toggleMap = () => {
    setMapOpen(!mapOpen);
    if (!mapOpen) requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const found = await geocode(q.includes("Houston") ? q : `${q}, Houston, TX`);
      if (!found.length) setErr("noMatch");
      else if (found.length === 1 || found[0].score >= 98) setHome(found[0].loc, found[0].address);
      else setCands(found);
    } catch {
      setErr("searchDown");
    } finally {
      setBusy(false);
    }
  }

  async function onMapPick(p: LngLat) {
    setHome(p, `${p[1].toFixed(5)}, ${p[0].toFixed(5)}`);
    const label = await reverseGeocode(p);
    if (label) setParams({ lat: p[1].toFixed(6), lng: p[0].toFixed(6), addr: label }, { replace: true });
    if (label) setQ(label);
  }

  const fitPoints: LngLat[] = result
    ? [result.point, ...(result.old ? [result.old.school.loc] : []), ...(result.now ? [result.now.school.loc] : []), ...(shuttle ? shuttlePoints([shuttle]) : [])]
    : d.zones.flatMap((z) => z.rings[0]);

  return (
    <div className={`split lookup-split${mapOpen ? " map-open" : ""}`}>
      <section className="panel">
        <h1>{tl.h1}</h1>
        <p className="tagline">{tl.tagline}</p>
        <p className="lede">{tl.lede}</p>

        <form className="search" onSubmit={onSearch} role="search">
          <label htmlFor="addr" className="sr-only">{tl.addrLabel}</label>
          <input id="addr" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tl.addrPlaceholder} autoComplete="street-address" />
          <button type="submit" className="button primary" disabled={busy}>{busy ? tl.searching : tl.check}</button>
        </form>
        <p className="small muted desktop-only">{tl.orMap}</p>
        <button type="button" className="button map-toggle mobile-only" aria-expanded={mapOpen} onClick={toggleMap}>
          {mapOpen ? tl.hideMap : tl.showMap}
        </button>
        {err && <p className="error">{tl[err]}</p>}
        {cands.length > 0 && (
          <ul className="cands">
            {cands.map((c) => (
              <li key={c.address}><button type="button" className="linkish" onClick={() => setHome(c.loc, c.address)}>{c.address}</button></li>
            ))}
          </ul>
        )}

        <div className="presets">
          <span className="small muted">{tl.tryZone}</span>
          {d.zones.map((z) => (
            <button key={z.nbr} type="button" className="chip" onClick={() => setHome(z.demoPoint ?? zoneSamplePoint(z.rings), tl.samplePoint(z.name))}>
              {z.name.replace(" ES", "")}
            </button>
          ))}
        </div>

        {result && stop && <Result r={result} addr={addr} stop={stop} onResetStop={resetStop} shuttle={shuttle} />}
        <Caveats />
        <DataVintage />
      </section>

      <section className="mapwrap" ref={mapRef}>
        <MapBase>
          <ClickToSet onPick={onMapPick} />
          {!result &&
            d.zones.map((z) => (
              <GeoJSON key={z.nbr} data={{ type: "Polygon", coordinates: z.rings } as any} style={{ color: COLORS.zone, weight: 2, fillOpacity: 0.12 }} interactive={false} />
            ))}
          {result && <RouteLayers d={d} r={result} shuttle={shuttle} />}
          {result && stop && (
            <Marker
              position={ll(stop)}
              icon={pinIcon("S", "pin-stop")}
              draggable
              eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setStop([p.lng, p.lat]); } }}
            >
              <Tooltip>{tl.dragStop}</Tooltip>
            </Marker>
          )}
          <FitTo points={fitPoints} />
        </MapBase>
        <MapLegend shuttle={!!shuttle} walks={!!result} />
      </section>
    </div>
  );
}
