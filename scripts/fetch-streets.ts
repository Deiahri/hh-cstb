// City street facts behind HPW's school-zone criteria, for every road a walk to a 2026–27 receiving school crosses:
//   1. its class and owner on the City's Major Thoroughfare and Freeway Plan (MTFP). Away from the school, HPW
//      considers a zone only on "a thoroughfare or collector", and "the street must be owned by the City of Houston";
//   2. whether it borders the receiving school (HPW's other path), from the City's road centerline and the school's
//      grounds;
//   3. for each (receiving school, newly crossed road) pair on the April 15 page, the cross streets just outside
//      where the walks cross it: the From/To on HPW's application.
// Writes public/data/street_context.json and adds `mtfp` and `centerline` to meta.json; compute.ts merges it into
// corridors.json and zone_requests.json. Run after `npm run data` and `npm run grounds`: `npm run streets`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type RawData, buildDataset } from "../src/lib/analyze";
import { coreName } from "../src/lib/crossings";
import { type BBox, type LngLat, haversine, lineParts, pointInRings, polygonRings } from "../src/lib/geo";
import { MIN_REQUEST_POINTS, forEachSample } from "./grid";

const COH = "https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services";
const MTFP_URL = `${COH}/COH_MTFP_view/FeatureServer/3`;
const CENTERLINE_URL = `${COH}/COH_RoadCenterline/FeatureServer/0`;
// The main Overpass server returns 504 under load; try it, then a mirror (same as fetch-grounds.ts).
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const PAD_M = 400; // query box around a road's crossing points: room for the cross streets past the outermost one
const ON_ROAD_M = 60; // a centerline piece this close to the City's crossed segments is the same road
const MTFP_M = 40; // an MTFP line of the same name this close to a crossing point classifies it
const BORDER_M = 30; // a street centerline this close to the school grounds borders the school
const GROUNDS_M = 150; // grounds within this distance of the campus point belong to it
const POINT_ONLY_M = 120; // no grounds anywhere: streets this close to the campus point, marked approximate
const NODE_M = 3; // centerline pieces meeting within this distance share an intersection

const dataDir = join(import.meta.dirname, "..", "public", "data");
const load = (k: string) => JSON.parse(readFileSync(join(dataDir, `${k}.geojson`), "utf8"));
const raw: RawData = {
  schools_old: load("schools_old"), schools_new: load("schools_new"),
  zones_old: load("zones_old"), zones_new: load("zones_new"),
  rail: load("rail"), ped_hin: load("ped_hin"), hin: load("hin"),
};
const ds = buildDataset(raw);

// ---- Names and geometry -----------------------------------------------------------

const ABBR: Record<string, string> = { STREET: "ST", ROAD: "RD", DRIVE: "DR", AVENUE: "AVE", BOULEVARD: "BLVD", LANE: "LN", PARKWAY: "PKWY", FREEWAY: "FWY" };
/** "Liberty Road" and "LIBERTY RD" compare equal; direction prefixes stay (W Hardy Rd isn't Hardy St). */
const norm = (s: string) => s.toUpperCase().replace(/[.,]/g, " ").split(/\s+/).filter(Boolean).map((w) => ABBR[w] ?? w).join(" ");
const sameRoad = (a: string, b: string) => norm(a) === norm(b);
/** Looser, for lines already close together: the City spells one stretch "Crosstimber St" and the next "Crosstimbers St". */
const looseName = (s: string) => coreName(s).replace(/S$/, "");
const DIRS = new Set(["N", "S", "E", "W"]);
/** "E WHITNEY ST" → "E Whitney St", "SSGT MACARIO GARCIA DR" → "SSgt Macario Garcia Dr", "75TH ST" → "75th St". */
export const streetLabel = (s: string) => norm(s).split(" ").map((w) =>
  DIRS.has(w) ? w : w === "SSGT" ? "SSgt" : /^\d/.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

function distToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180), ky = 110540;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
function distToParts(p: LngLat, parts: LngLat[][]): number {
  let best = Infinity;
  for (const part of parts) for (let i = 1; i < part.length; i++) best = Math.min(best, distToSegment(p, part[i - 1], part[i]));
  return best;
}
/** Metres between a street's line parts and a polygon (0 if the street enters it). */
function lineToPolygon(parts: LngLat[][], rings: LngLat[][]): number {
  if (parts.some((part) => part.some((v) => pointInRings(v, rings)))) return 0;
  let best = Infinity;
  for (const part of parts) for (const v of part) best = Math.min(best, distToParts(v, rings));
  for (const ring of rings) for (const v of ring) best = Math.min(best, distToParts(v, parts));
  return best;
}
function paddedBox(pts: LngLat[], m: number): BBox {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const midLat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dy = m / 110540, dx = m / (111320 * Math.cos((midLat * Math.PI) / 180));
  return [Math.min(...xs) - dx, Math.min(...ys) - dy, Math.max(...xs) + dx, Math.max(...ys) + dy];
}
const mode = <T,>(xs: T[]): T | null => {
  const n = new Map<T, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

// ---- ArcGIS and Overpass ------------------------------------------------------------

async function getJson(url: string, init?: RequestInit): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(JSON.stringify(body.error));
      return body;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url.slice(0, 160)}\n  ${e}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

interface Line { props: Record<string, any>; parts: LngLat[][] }
const pulled = { mtfp: 0, centerline: 0 };
const cache = new Map<string, Line[]>();
/** Every feature of a City line layer that intersects the box (paged). */
async function linesInBox(url: string, outFields: string, box: BBox): Promise<Line[]> {
  const ck = `${url}|${box.map((v) => v.toFixed(5)).join(",")}`;
  if (cache.has(ck)) return cache.get(ck)!;
  const out: Line[] = [];
  for (let offset = 0; ; offset += 2000) {
    const p = new URLSearchParams({
      where: "1=1", outFields, outSR: "4326", geometryPrecision: "6",
      geometry: box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
      orderByFields: "OBJECTID", resultOffset: String(offset), resultRecordCount: "2000", f: "geojson",
    });
    const page = await getJson(`${url}/query?${p}`);
    for (const f of page.features) out.push({ props: f.properties, parts: lineParts(f.geometry) });
    if (!(page.exceededTransferLimit || page.properties?.exceededTransferLimit) || !page.features.length) break;
  }
  if (url === MTFP_URL) pulled.mtfp += out.length; else pulled.centerline += out.length;
  cache.set(ck, out);
  return out;
}
const centerline = (box: BBox) => linesInBox(CENTERLINE_URL, "fullname,zipleft,zipright", box);
const mtfpLines = (box: BBox) => linesInBox(MTFP_URL, "FULL_NAME,ST_TYPE,ST_STATUS,OWNERSHIP", box);

async function overpassGrounds(loc: LngLat): Promise<LngLat[][] | null> {
  const q = `[out:json][timeout:60];(way(around:${GROUNDS_M},${loc[1]},${loc[0]})["amenity"="school"];);out geom;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const body = await getJson(OVERPASS[attempt % OVERPASS.length], {
        method: "POST", body: new URLSearchParams({ data: q }),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "closed-school-walk-check/0.1" },
      });
      const rings = (body.elements as any[])
        .map((e) => (e.geometry as { lat: number; lon: number }[]).map((g) => [g.lon, g.lat] as LngLat))
        .filter((r) => r.length >= 4);
      const inside = rings.find((r) => pointInRings(loc, [r]));
      if (inside) return [inside];
      const near = rings.map((r) => ({ r, d: distToParts(loc, [r]) })).sort((a, b) => a.d - b.d)[0];
      return near && near.d <= GROUNDS_M ? [near.r] : null;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

// ---- The walks: every road crossed on the way to a receiving school ----------------

interface RoadAcc { key: string; name: string; at: LngLat[]; parts: Map<string, LngLat[][]>; schools: Set<number> }
interface ReqAcc { nbr: number; key: string; name: string; at: LngLat[]; parts: Map<string, LngLat[][]> }
const roads = new Map<string, RoadAcc>();
const reqs = new Map<string, ReqAcc>();
const segParts = (l: { layer: string; id: number }) => (l.layer === "pedHin" ? ds.pedHin : ds.hin)[l.id].parts;

forEachSample(ds, (_zone, _pt, r) => {
  const oldKeys = new Set(r.old.hazards.map((h) => h.key));
  const nbr = r.now.school.nbr;
  for (const h of r.now.hazards) {
    if (h.kind !== "road") continue;
    const road: RoadAcc = roads.get(h.key) ?? { key: h.key, name: h.key.slice(5), at: [], parts: new Map(), schools: new Set() };
    road.at.push(h.at);
    road.schools.add(nbr);
    for (const l of h.lineIds) road.parts.set(`${l.layer}:${l.id}`, segParts(l));
    roads.set(h.key, road);
    if (oldKeys.has(h.key)) continue;
    const id = `${nbr}|${h.key}`;
    const req: ReqAcc = reqs.get(id) ?? { nbr, key: h.key, name: h.key.slice(5), at: [], parts: new Map() };
    req.at.push(h.at);
    for (const l of h.lineIds) req.parts.set(`${l.layer}:${l.id}`, segParts(l));
    reqs.set(id, req);
  }
});

// ---- Receiving schools: grounds, the streets bordering them, ZIP ------------------------

const groundsFile = join(dataDir, "campus_grounds.geojson");
const snapshotGrounds: LngLat[][][] = existsSync(groundsFile)
  ? (JSON.parse(readFileSync(groundsFile, "utf8")).features as any[]).flatMap((f) =>
      f.geometry.type === "Polygon" ? [polygonRings(f.geometry)] : (f.geometry.coordinates as LngLat[][][]))
  : [];

interface SchoolCtx { nbr: number; name: string; address: string; zip: number | null; bordering: string[]; grounds: "osm" | "point" }
const schools = new Map<number, SchoolCtx>();
for (const nbr of [...new Set([...roads.values()].flatMap((r) => [...r.schools]))].sort((a, b) => a - b)) {
  const s = ds.schoolsNew.get(nbr)!;
  let rings: LngLat[][] | null = snapshotGrounds.find((g) => pointInRings(s.loc, g))
    ?? snapshotGrounds.map((g) => ({ g, d: distToParts(s.loc, g) })).filter((x) => x.d <= GROUNDS_M).sort((a, b) => a.d - b.d)[0]?.g
    ?? null;
  if (!rings) rings = await overpassGrounds(s.loc);
  const box = paddedBox(rings ? rings.flat() : [s.loc], (rings ? BORDER_M : POINT_ONLY_M) + 50);
  const near = (await centerline(box)).filter((l) => l.props.fullname &&
    (rings ? lineToPolygon(l.parts, rings) <= BORDER_M : distToParts(s.loc, l.parts) <= POINT_ONLY_M));
  const addrStreet = s.address.replace(/^\d+\s+/, "");
  const bordering = new Set(near.map((l) => norm(l.props.fullname)));
  bordering.add(norm(addrStreet)); // the address street always borders
  // ZIP: the address street's nearest centerline piece, looked for a little wider than "bordering".
  const onAddr = (await centerline(paddedBox([s.loc], 400))).filter((l) => l.props.fullname && sameRoad(l.props.fullname, addrStreet))
    .sort((a, b) => distToParts(s.loc, a.parts) - distToParts(s.loc, b.parts));
  const zip = onAddr[0] ? (onAddr[0].props.zipleft || onAddr[0].props.zipright || null) : null;
  schools.set(nbr, { nbr, name: s.name, address: s.address, zip, bordering: [...bordering].sort(), grounds: rings ? "osm" : "point" });
}

// ---- MTFP class at the crossing points ---------------------------------------------

interface StreetClass { type: string | null; owner: string | null; status: string | null; thoroughfareOrCollector: boolean; classifiedPct: number }
async function classify(name: string, at: LngLat[]): Promise<StreetClass> {
  const lines = (await mtfpLines(paddedBox(at, MTFP_M + 20))).filter((l) => l.props.FULL_NAME);
  const hits: string[] = [];
  for (const p of at) {
    const cands = lines
      .filter((l) => sameRoad(l.props.FULL_NAME, name) || looseName(l.props.FULL_NAME) === looseName(name))
      .map((l) => ({ l, d: distToParts(p, l.parts) }))
      .filter((c) => c.d <= MTFP_M)
      .sort((a, b) => a.d - b.d);
    const l = cands[0]?.l;
    if (l) hits.push(JSON.stringify([l.props.ST_TYPE && l.props.ST_TYPE !== "N/A" ? l.props.ST_TYPE : null, l.props.OWNERSHIP?.trim() || null, l.props.ST_STATUS ?? null]));
  }
  const classifiedPct = at.length ? Math.round((1000 * hits.length) / at.length) / 10 : 0;
  // Most crossing points have no MTFP line: a local street, not on the plan.
  if (classifiedPct < 50) return { type: null, owner: null, status: null, thoroughfareOrCollector: false, classifiedPct };
  const [type, owner, status] = JSON.parse(mode(hits)!) as [string | null, string | null, string | null];
  return { type, owner, status, thoroughfareOrCollector: !!type && /thoroughfare|collector/i.test(type), classifiedPct };
}

// ---- From/To: the cross streets just outside where the walks cross -------------------

interface Limits { from: string | null; to: string | null; fromLoc: LngLat | null; toLoc: LngLat | null }
async function limits(req: ReqAcc): Promise<Limits | null> {
  const hinParts = [...req.parts.values()].flat();
  const cl = (await centerline(paddedBox(req.at, PAD_M))).filter((l) => l.props.fullname);
  let road = cl.filter((l) => sameRoad(l.props.fullname, req.name) && l.parts.some((p) => p.some((v) => distToParts(v, hinParts) <= ON_ROAD_M)));
  if (!road.length) road = cl.filter((l) => looseName(l.props.fullname) === looseName(req.name) && l.parts.some((p) => p.some((v) => distToParts(v, hinParts) <= 25)));
  if (!road.length) return null;
  // Follow the same street outward from the crossed segments, piece by connected piece, so the cross streets past
  // the outermost crossing are found even where the City's crash segment ends.
  const same = (l: Line) => sameRoad(l.props.fullname, req.name) || looseName(l.props.fullname) === looseName(req.name);
  for (let grown = true; grown;) {
    grown = false;
    const ends = road.flatMap((l) => l.parts.flatMap((p) => [p[0], p[p.length - 1]]));
    for (const l of cl) {
      if (road.includes(l) || !same(l)) continue;
      if (l.parts.some((p) => [p[0], p[p.length - 1]].some((e) => ends.some((x) => haversine(x, e) <= NODE_M)))) { road.push(l); grown = true; }
    }
  }

  // Local metres around the road, and its main axis, pointed east (or north for a north–south road).
  const verts = road.flatMap((l) => l.parts.flat());
  const ref = verts[0], kx = 111320 * Math.cos((ref[1] * Math.PI) / 180), ky = 110540;
  const xy = (p: LngLat) => [(p[0] - ref[0]) * kx, (p[1] - ref[1]) * ky];
  const P = verts.map(xy), mx = P.reduce((a, p) => a + p[0], 0) / P.length, my = P.reduce((a, p) => a + p[1], 0) / P.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ax = Math.cos(th), ay = Math.sin(th);
  if (Math.abs(ax) >= Math.abs(ay) ? ax < 0 : ay < 0) { ax = -ax; ay = -ay; }
  const t = (p: LngLat) => { const [x, y] = xy(p); return (x - mx) * ax + (y - my) * ay; };

  // Intersections: a differently named street meeting the road's pieces.
  const roadEnds = road.flatMap((l) => l.parts.flatMap((p) => [p[0], p[p.length - 1]]));
  const roadVerts = verts;
  const xs: { loc: LngLat; name: string; t: number }[] = [];
  for (const l of cl) {
    const nm = l.props.fullname as string;
    if (road.includes(l) || looseName(nm) === looseName(req.name) || /\bRAMP\b|\bEXIT\b|\bENT\b/i.test(nm)) continue;
    const ends = l.parts.flatMap((p) => [p[0], p[p.length - 1]]);
    const meet = ends.find((e) => roadVerts.some((v) => haversine(v, e) <= NODE_M))
      ?? l.parts.flat().find((v) => roadEnds.some((e) => haversine(v, e) <= NODE_M));
    if (meet) xs.push({ loc: meet, name: streetLabel(nm), t: t(meet) });
  }
  const ts = req.at.map(t), tmin = Math.min(...ts), tmax = Math.max(...ts);
  const pick = (cands: typeof xs, nearest: (a: number, b: number) => number) => {
    if (!cands.length) return null;
    const best = cands.sort((a, b) => nearest(a.t, b.t))[0];
    // Several names at one node (a street that changes name there): list them.
    const names = [...new Set(cands.filter((c) => Math.abs(c.t - best.t) <= 8).map((c) => c.name))];
    return { name: names.join(" / "), loc: best.loc, t: best.t };
  };
  const from = pick(xs.filter((x) => x.t < tmin - 1), (a, b) => b - a);
  const to = pick(xs.filter((x) => x.t > tmax + 1), (a, b) => a - b);
  return { from: from?.name ?? null, to: to?.name ?? null, fromLoc: from?.loc ?? null, toLoc: to?.loc ?? null };
}

// ---- Run ------------------------------------------------------------------------------

const roadsOut: Record<string, { streetClass: StreetClass; bordersSchool: string[] }> = {};
for (const r of [...roads.values()].sort((a, b) => a.key.localeCompare(b.key))) {
  const streetClass = await classify(r.name, r.at);
  const bordersSchool = [...r.schools].map((n) => schools.get(n)!).filter((s) => s.bordering.includes(norm(r.name))).map((s) => s.name);
  roadsOut[r.key] = { streetClass, bordersSchool };
}

const requestsOut: Record<string, { streetClass: StreetClass; borders: boolean; limits: Limits | null }> = {};
const rows = [...reqs.entries()].filter(([, q]) => q.at.length >= MIN_REQUEST_POINTS).sort((a, b) => b[1].at.length - a[1].at.length);
for (const [id, q] of rows) {
  requestsOut[id] = {
    streetClass: await classify(q.name, q.at),
    borders: schools.get(q.nbr)!.bordering.includes(norm(q.name)),
    limits: await limits(q),
  };
}

const fetchedAt = new Date().toISOString();
writeFileSync(join(dataDir, "street_context.json"), JSON.stringify({
  fetchedAt,
  method: { padM: PAD_M, onRoadM: ON_ROAD_M, mtfpM: MTFP_M, borderM: BORDER_M, pointOnlyM: POINT_ONLY_M, minRequestPoints: MIN_REQUEST_POINTS },
  schools: Object.fromEntries([...schools.values()].map((s) => [s.nbr, s])),
  roads: roadsOut,
  requests: requestsOut,
}));

const layerDate = async (url: string) => {
  const info = await getJson(`${url}?f=json`);
  const e = info.editingInfo?.lastEditDate ?? info.editingInfo?.dataLastEditDate;
  return e ? new Date(e).toISOString().slice(0, 10) : null;
};
const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));
meta.mtfp = { label: "Major Thoroughfare and Freeway Plan (City of Houston)", url: MTFP_URL, count: pulled.mtfp, lastEditDate: await layerDate(MTFP_URL), fetchedAt };
meta.centerline = { label: "Road centerline (City of Houston)", url: CENTERLINE_URL, count: pulled.centerline, lastEditDate: await layerDate(CENTERLINE_URL), fetchedAt };
writeFileSync(join(dataDir, "meta.json"), JSON.stringify(meta, null, 2));

// ---- Print ------------------------------------------------------------------------------

for (const s of schools.values()) console.log(`${s.name.padEnd(18)} ZIP ${s.zip ?? "?"} grounds ${s.grounds.padEnd(5)} borders: ${s.bordering.join(", ")}`);
console.log("");
for (const [id, q] of rows) {
  const o = requestsOut[id], s = schools.get(q.nbr)!, c = o.streetClass, l = o.limits;
  console.log(`${s.name.padEnd(16)} ${streetLabel(q.name).padEnd(20)} ${String(q.at.length).padStart(4)} pts | ${(c.type ?? "not on MTFP").padEnd(22)} ${(c.owner ?? "").padEnd(6)} ${String(c.classifiedPct).padStart(5)}% | borders ${o.borders ? "yes" : "no "} | ${l ? `${l.from ?? "?"} → ${l.to ?? "?"}` : "no centerline match"}`);
}
console.log(`\nMTFP lines pulled ${pulled.mtfp}, centerline pieces ${pulled.centerline}. Wrote street_context.json (${Object.keys(roadsOut).length} roads, ${rows.length} requests).`);
