// Recomputes every closure-zone figure from the snapshot in public/data and
// writes zones.json + corridors.json + shuttles.json + zone_requests.json for the app, and ../VERIFY.md comparing
// the recomputed numbers against the claims in ../Report.md and the warning-families report.
// Run after `npm run data`, `npm run crossings` and `npm run streets`: `npm run compute`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LngLat, METERS_PER_MILE, haversine, pointInRings, polygonAt } from "../src/lib/geo";
import { type Hazard, type RawData, analyzeAddress, buildDataset, flags } from "../src/lib/analyze";
import {
  NEAR_M, controlFor, controlLabel, crossingsOnTrack, railKind, railLabel, signalLabel, signalsOnRoad,
} from "../src/lib/crossings";
import { SHUTTLE_PAIRS, SHUTTLE_SOURCES } from "./shuttle-pairs";
import { MIN_REQUEST_POINTS } from "./grid";

const dataDir = join(import.meta.dirname, "..", "public", "data");
const load = (k: string) => JSON.parse(readFileSync(join(dataDir, `${k}.geojson`), "utf8"));
const raw: RawData = {
  schools_old: load("schools_old"), schools_new: load("schools_new"),
  zones_old: load("zones_old"), zones_new: load("zones_new"),
  rail: load("rail"), ped_hin: load("ped_hin"), hin: load("hin"),
  signals: JSON.parse(readFileSync(join(dataDir, "signals.json"), "utf8")),
  rail_crossings: JSON.parse(readFileSync(join(dataDir, "rail_crossings.json"), "utf8")),
};
const ds = buildDataset(raw);
const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));
// City street class, the streets bordering each receiving school, and From/To limits (scripts/fetch-streets.ts).
const streetCtxFile = join(dataDir, "street_context.json");
const streetCtx = existsSync(streetCtxFile) ? JSON.parse(readFileSync(streetCtxFile, "utf8")) : null;
if (!streetCtx) console.warn("No street_context.json; run `npm run streets`. The April 15 page will have no street class or limits.");

const SPACING_M = 110;
const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

interface HazardShares { ped: number; hin: number; rail: number; combined: number }
interface Tally { n: number; ped: number; hin: number; rail: number; combined: number }
const emptyTally = (): Tally => ({ n: 0, ped: 0, hin: 0, rail: 0, combined: 0 });
function addTally(t: Tally, hs: Hazard[]) {
  const f = flags(hs);
  t.n++; t.ped += +f.ped; t.hin += +f.hin; t.rail += +f.rail; t.combined += +f.combined;
}
const shares = (t: Tally): HazardShares => ({ ped: pct(t.ped, t.n), hin: pct(t.hin, t.n), rail: pct(t.rail, t.n), combined: pct(t.combined, t.n) });

interface CorridorAcc {
  key: string; kind: "road" | "rail"; name: string; pedDangerous: boolean; highInjury: boolean;
  pointsNewRoute: number; pointsOldRoute: number; pointsNewlyCrossed: number;
  zones: Set<string>; receiving: Set<string>; segs: Map<string, { layer: string; id: number }>;
  /** Per new-walk crossing: metres from where the line crosses to the nearest signal / public rail crossing. */
  controlD: number[];
  /** Where the new walks cross it. */
  at: LngLat[];
  /** Controls on this road or track within 500 m of any point where a new walk crosses it. */
  controls: Map<string, { label: string; kind: "signal" | "rail"; loc: LngLat; railKind?: string }>;
  nearestCount: Map<string, number>;
}
const corridors = new Map<string, CorridorAcc>();
// A railroad is one hazard per company on the Lookup page, but on the City list each zone's track is its own row,
// so "the Port Houston track" can be named. Roads stay one row citywide.
const shortRail = (company: string) =>
  company === "Railroad" ? "Unnamed railroad" : company.replace(/ (Railroad|Railway) (Company|Association)$/, "");
function corridor(h: Hazard, zone: string): CorridorAcc {
  const key = h.kind === "rail" ? `${h.key}@${zone}` : h.key;
  let c = corridors.get(key);
  if (!c) {
    const name = h.kind === "rail" ? `${shortRail(h.key.slice(5))} track, ${zone.replace(/ ES$/, "")} zone` : h.name;
    c = { key, kind: h.kind, name, pedDangerous: false, highInjury: false,
      pointsNewRoute: 0, pointsOldRoute: 0, pointsNewlyCrossed: 0, zones: new Set(), receiving: new Set(), segs: new Map(),
      controlD: [], at: [], controls: new Map(), nearestCount: new Map() };
    corridors.set(key, c);
  }
  c.pedDangerous ||= h.pedDangerous;
  c.highInjury ||= h.highInjury;
  return c;
}

// Where-to-cross tallies, per walk, to check the app against the warning-families report.
type Walk = "receiving" | "pickup";
const xTally = () => ({ points: 0, anyRoadFar: 0, anyRailFar: 0 });
const xAll: Record<Walk, ReturnType<typeof xTally>> = { receiving: xTally(), pickup: xTally() };
const xZone = new Map<string, Record<Walk, ReturnType<typeof xTally>>>();

const zones: any[] = [];
// Per zone: sample points whose active-rail crossing is only on the walk to the closed campus (the shuttle pickup)
// or only on the walk to the 2026–27 campus. The Lookup page's two walks show this split address by address.
const railSplit = new Map<string, { pickupOnly: number; receivingOnly: number; n: number }>();
const allOld = emptyTally(), allNew = emptyTally();
let allN = 0, allOver2 = 0, allOver15 = 0;

// "Before April 15" page: per receiving school, each road its new walkers cross that their walk to the old campus
// didn't. One row per (receiving school, road), since each receiving principal files their own application.
interface RequestAcc {
  nbr: number; zone: string; key: string; name: string; pedDangerous: boolean; highInjury: boolean;
  at: LngLat[]; segs: Map<string, { layer: string; id: number }>; controlD: number[]; nearestCount: Map<string, number>;
}
const requests = new Map<string, RequestAcc>();
/** Sample points per (receiving school, closed zone), and how many of them newly cross active rail. */
const recvPoints = new Map<string, { nbr: number; zone: string; n: number; railNew: number }>();

for (const zone of ds.zonesOld.filter((z) => ds.closedIds.has(Number(z.props.Campus__Number)))) {
  const nbr = Number(zone.props.Campus__Number);
  const name = zone.props.Campus_Short_Name;
  const oldSchool = ds.schoolsOld.get(nbr);
  const [minX, minY, maxX, maxY] = zone.bbox;
  const midLat = (minY + maxY) / 2;
  const dLat = SPACING_M / 111320;
  const dLon = SPACING_M / (111320 * Math.cos((midLat * Math.PI) / 180));

  const receiving = new Map<string, number>();
  const deltas: number[] = [];
  const newDists: number[] = [];
  const oldDists: number[] = [];
  let farther = 0, unassigned = 0;
  // Candidate demo points: where the new walk newly crosses rail or a ped-dangerous road.
  const demoCands: { pt: LngLat; dNew: number; score: number }[] = [];
  const tOld = emptyTally(), tNew = emptyTally();
  // Roads on the walk to the old campus, where the shuttle picks up (the pickup cards).
  const pickupRoads = new Map<string, { name: string; n: number; pedDangerous: boolean }>();

  for (let y = minY + dLat / 2; y < maxY; y += dLat) {
    for (let x = minX + dLon / 2; x < maxX; x += dLon) {
      const pt: LngLat = [x, y];
      if (!pointInRings(pt, zone.rings)) continue;
      const r = analyzeAddress(pt, ds);
      if (!r.old || !r.now) { unassigned++; continue; }
      receiving.set(r.now.school.name, (receiving.get(r.now.school.name) ?? 0) + 1);
      const d = r.now.distance - r.old.distance;
      deltas.push(d); newDists.push(r.now.distance); oldDists.push(r.old.distance);
      if (d > 0) farther++;
      addTally(tOld, r.old.hazards); addTally(tNew, r.now.hazards);
      addTally(allOld, r.old.hazards); addTally(allNew, r.now.hazards);
      const railPickup = r.old.hazards.some((h) => h.kind === "rail"), railRecv = r.now.hazards.some((h) => h.kind === "rail");
      const rs = railSplit.get(name) ?? { pickupOnly: 0, receivingOnly: 0, n: 0 };
      rs.n++;
      if (railPickup && !railRecv) rs.pickupOnly++;
      if (railRecv && !railPickup) rs.receivingOnly++;
      railSplit.set(name, rs);

      const oldKeys = new Set(r.old.hazards.map((h) => h.key));
      const fresh = r.now.hazards.filter((h) => !oldKeys.has(h.key));
      if (fresh.length) demoCands.push({ pt, dNew: r.now.distance, score: fresh.filter((h) => h.kind === "rail" || h.pedDangerous).length });
      for (const h of r.old.hazards) {
        if (h.kind !== "road") continue;
        const pr = pickupRoads.get(h.key) ?? { name: h.name, n: 0, pedDangerous: false };
        pr.n++; pr.pedDangerous ||= h.pedDangerous;
        pickupRoads.set(h.key, pr);
      }
      const rp = recvPoints.get(`${r.now.school.nbr}|${name}`) ?? { nbr: r.now.school.nbr, zone: name, n: 0, railNew: 0 };
      rp.n++;
      if (fresh.some((h) => h.kind === "rail")) rp.railNew++;
      recvPoints.set(`${r.now.school.nbr}|${name}`, rp);
      for (const h of fresh) {
        if (h.kind !== "road") continue;
        const id = `${r.now.school.nbr}|${h.key}`;
        const q: RequestAcc = requests.get(id) ?? { nbr: r.now.school.nbr, zone: name, key: h.key, name: h.name, pedDangerous: false, highInjury: false,
          at: [], segs: new Map(), controlD: [], nearestCount: new Map() };
        q.pedDangerous ||= h.pedDangerous; q.highInjury ||= h.highInjury;
        q.at.push(h.at);
        for (const l of h.lineIds) q.segs.set(`${l.layer}:${l.id}`, l);
        const ctl = controlFor(h, ds);
        q.controlD.push(ctl ? ctl.d : Infinity);
        if (ctl) q.nearestCount.set(controlLabel(ctl), (q.nearestCount.get(controlLabel(ctl)) ?? 0) + 1);
        requests.set(id, q);
      }
      for (const h of r.old.hazards) corridor(h, name).pointsOldRoute++;
      for (const h of r.now.hazards) {
        const c = corridor(h, name);
        c.pointsNewRoute++;
        c.zones.add(name);
        c.receiving.add(r.now.school.name);
        if (!oldKeys.has(h.key)) c.pointsNewlyCrossed++;
        for (const l of h.lineIds) c.segs.set(`${l.layer}:${l.id}`, l);
        const ctl = controlFor(h, ds);
        c.controlD.push(ctl ? ctl.d : Infinity);
        c.at.push(h.at);
        if (ctl) {
          const label = controlLabel(ctl);
          c.nearestCount.set(label, (c.nearestCount.get(label) ?? 0) + 1);
        }
      }
      // Any crossing on either walk with no signal / public rail crossing within NEAR_M (the report's "far").
      const zx = xZone.get(name) ?? { receiving: xTally(), pickup: xTally() };
      xZone.set(name, zx);
      for (const [walk, hz] of [["receiving", r.now.hazards], ["pickup", r.old.hazards]] as [Walk, Hazard[]][]) {
        const far = (kind: string) => hz.some((h) => h.kind === kind && !((controlFor(h, ds)?.d ?? Infinity) <= NEAR_M));
        for (const t of [xAll[walk], zx[walk]]) {
          t.points++;
          if (far("road")) t.anyRoadFar++;
          if (far("rail")) t.anyRailFar++;
        }
      }
    }
  }

  const n = deltas.length;
  const over2 = newDists.filter((d) => d >= 2 * METERS_PER_MILE).length;
  const over15 = newDists.filter((d) => d >= 1.5 * METERS_PER_MILE).length;
  allN += n; allOver2 += over2; allOver15 += over15;

  // Second method (the report's run-12 method): the 2026–27 zone that contains
  // the closed campus's own point.
  const probe = oldSchool ? polygonAt(oldSchool.loc, ds.zonesNew)?.props.Campus_Short_Name ?? null : null;

  zones.push({
    nbr, name,
    oldSchool: oldSchool && { name: oldSchool.name, address: oldSchool.address, loc: oldSchool.loc },
    receiving: [...receiving.entries()].sort((a, b) => b[1] - a[1]).map(([school, k]) => {
      const s = [...ds.schoolsNew.values()].find((v) => v.name === school)!;
      return { name: school, address: s.address, loc: s.loc, share: pct(k, n) };
    }),
    receivingByCampusPoint: probe,
    points: n, unassigned,
    medianOldM: median(oldDists), medianNewM: median(newDists),
    medianDeltaM: median(deltas),
    maxNewMi: Math.max(...newDists) / METERS_PER_MILE,
    meanNewMi: newDists.reduce((a, b) => a + b, 0) / n / METERS_PER_MILE,
    pctFarther: pct(farther, n),
    pctOver2Old: pct(oldDists.filter((d) => d >= 2 * METERS_PER_MILE).length, n),
    pctOver2New: pct(over2, n),
    pctOver15New: pct(over15, n),
    hazardOld: shares(tOld), hazardNew: shares(tNew),
    pickupRoads: [...pickupRoads.values()].sort((a, b) => b.n - a.n).slice(0, 3)
      .map((pr) => ({ name: pr.name, share: pct(pr.n, n), pedDangerous: pr.pedDangerous })),
    rings: zone.rings,
    // A representative point for the demo shortcuts: the strongest newly-crossed
    // case, nearest the zone's median distance to the new school.
    demoPoint: (() => {
      const med = median(newDists);
      const best = Math.max(0, ...demoCands.map((c) => c.score));
      const pool = demoCands.filter((c) => c.score === best);
      pool.sort((a, b) => Math.abs(a.dNew - med) - Math.abs(b.dNew - med));
      return pool[0]?.pt ?? null;
    })(),
  });
}
zones.sort((a, b) => a.name.localeCompare(b.name));

// The controls within 500 m of where the new walks cross each corridor, for the Corridors map and the
// "lights within 500 m" count (the warning-families report's signalsNearby).
const within500 = (loc: LngLat, at: LngLat[]) => at.some((a) => haversine(a, loc) <= 500);
for (const c of corridors.values()) {
  const base = c.key.split("@")[0];
  if (c.kind === "road")
    for (const s of signalsOnRoad(ds, base).filter((s) => within500(s.loc, c.at)))
      c.controls.set(`${s.loc}`, { label: signalLabel(s), kind: "signal", loc: s.loc });
  else
    for (const x of crossingsOnTrack(ds, base).filter((x) => within500(x.loc, c.at)))
      c.controls.set(x.id, { label: railLabel(x), kind: "rail", loc: x.loc, railKind: railKind(x) });
}

/**
 * Is there a traffic signal (roads) or an open public crossing (rail) near where the new walks cross it?
 * "none": nothing within 500 m of any crossing point. "far": under half the crossings have one within NEAR_M.
 */
function controlStats(c: CorridorAcc) {
  const ds_ = c.controlD, n = ds_.length;
  const finite = ds_.filter(Number.isFinite).sort((a, b) => a - b);
  const within = (m: number) => pct(ds_.filter((d) => d <= m).length, n);
  const nearest = [...c.nearestCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const within250Pct = within(NEAR_M);
  return {
    crossings: n,
    within250Pct,
    within500Pct: within(500),
    medianM: finite.length ? Math.round(median(finite)) : null,
    controlsWithin500: c.controls.size,
    nearest,
    status: c.controls.size === 0 ? "none" : within250Pct < 50 ? "far" : "near",
  } as const;
}

// Crash/death counts per corridor: sum over the distinct segments any sample
// route crossed, taking the larger of the two City layers' sums (they overlap).
const corridorList = [...corridors.values()].map((c) => {
  const sums = { pedHin: [0, 0, 0], hin: [0, 0, 0] } as Record<string, number[]>;
  const segments: { layer: string; id: number }[] = [];
  for (const s of c.segs.values()) {
    segments.push(s);
    if (s.layer === "rail") continue;
    const p = (s.layer === "pedHin" ? ds.pedHin : ds.hin)[s.id].props;
    sums[s.layer][0] += p.ped_crash_count ?? 0;
    sums[s.layer][1] += p.ped_death_count ?? 0;
    sums[s.layer][2] += p.total_crash_count ?? 0;
  }
  return {
    key: c.key, kind: c.kind, name: c.name, pedDangerous: c.pedDangerous, highInjury: c.highInjury,
    pointsNewRoute: c.pointsNewRoute, pointsOldRoute: c.pointsOldRoute, pointsNewlyCrossed: c.pointsNewlyCrossed,
    zones: [...c.zones].sort(),
    pedCrashes: Math.max(sums.pedHin[0], sums.hin[0]),
    pedDeaths: Math.max(sums.pedHin[1], sums.hin[1]),
    totalCrashes: Math.max(sums.pedHin[2], sums.hin[2]),
    segments,
    receiving: [...c.receiving].sort(),
    control: controlStats(c),
    controls: [...c.controls.values()],
    // HPW's school-zone criteria turn on these (Corridors "options" column; zone_requests.json below).
    ...(c.kind === "road" && streetCtx
      ? { streetClass: streetCtx.roads[c.key]?.streetClass ?? null, bordersSchool: (streetCtx.roads[c.key]?.bordersSchool ?? []) as string[] }
      : {}),
  };
})
  // Every road or track the new walks cross. The Corridors page shows the newly crossed ones by default and can
  // add the ones the walk to the old campus crosses too (Airline Dr and the others the brief listed as new).
  .filter((c) => c.pointsNewRoute > 0)
  .sort((a, b) => b.pointsNewlyCrossed - a.pointsNewlyCrossed || b.pointsNewRoute - a.pointsNewRoute);
const newlyCrossedCount = corridorList.filter((c) => c.pointsNewlyCrossed > 0).length;

const totals = {
  points: allN,
  spacingM: SPACING_M,
  pctOver2New: pct(allOver2, allN),
  pctOver15New: pct(allOver15, allN),
  hazardOld: shares(allOld),
  hazardNew: shares(allNew),
  closedZones: zones.length,
  zonesOld: ds.zonesOld.length, zonesNew: ds.zonesNew.length,
  schoolsOld: ds.schoolsOld.size, schoolsNew: ds.schoolsNew.size,
  computedAt: new Date().toISOString(),
};

writeFileSync(join(dataDir, "zones.json"), JSON.stringify({ totals, zones }));
writeFileSync(join(dataDir, "corridors.json"), JSON.stringify(corridorList));

// ---- "Before April 15": one draft school-zone application per receiving school -----------------
// HPW's paths: the street "borders the school", or it "does not border the school but is a thoroughfare or
// collector"; either way it "must be owned by the City of Houston". HPW decides after its own study; this only
// sorts the streets by which written path they could use.
function segCrashes(segs: Iterable<{ layer: string; id: number }>) {
  const sums = { pedHin: [0, 0], hin: [0, 0] } as Record<string, number[]>;
  for (const s of segs) {
    if (s.layer === "rail") continue;
    const p = (s.layer === "pedHin" ? ds.pedHin : ds.hin)[s.id].props;
    sums[s.layer][0] += p.ped_crash_count ?? 0;
    sums[s.layer][1] += p.ped_death_count ?? 0;
  }
  return { pedCrashes: Math.max(sums.pedHin[0], sums.hin[0]), pedDeaths: Math.max(sums.pedHin[1], sums.hin[1]) };
}
const requestRows = [...requests.entries()].map(([id, q]) => {
  const school = ds.schoolsNew.get(q.nbr)!;
  const base = recvPoints.get(`${q.nbr}|${q.zone}`)!;
  const ctx = streetCtx?.requests[id];
  const finite = q.controlD.filter(Number.isFinite);
  const streetClass = ctx?.streetClass ?? null;
  const borders: boolean = ctx?.borders ?? false;
  return {
    id, nbr: q.nbr, key: q.key, name: q.name, zone: q.zone,
    points: q.at.length, share: pct(q.at.length, base.n),
    pedDangerous: q.pedDangerous, highInjury: q.highInjury, ...segCrashes(q.segs.values()),
    segments: [...q.segs.values()],
    at: q.at.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]),
    lights: {
      within500: signalsOnRoad(ds, q.key).filter((s) => within500(s.loc, q.at)).length,
      medianM: finite.length ? Math.round(median(finite)) : null,
      within250Pct: pct(q.controlD.filter((d) => d <= NEAR_M).length, q.controlD.length),
      nearest: [...q.nearestCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    },
    medianToSchoolM: Math.round(median(q.at.map((a) => haversine(a, school.loc)))),
    streetClass, borders, limits: ctx?.limits ?? null,
    path: borders ? "borders" : streetClass?.thoroughfareOrCollector ? "thoroughfare-collector" : "neither",
  };
});
const zoneRequests = [...recvPoints.values()]
  .sort((a, b) => a.zone.localeCompare(b.zone) || b.n - a.n)
  .map((rp) => {
    const s = ds.schoolsNew.get(rp.nbr)!;
    const sc = streetCtx?.schools[rp.nbr];
    const rows = requestRows.filter((r) => r.nbr === rp.nbr && r.zone === rp.zone).sort((a, b) => b.points - a.points);
    return {
      nbr: rp.nbr, name: s.name, address: s.address, loc: s.loc, zip: sc?.zip ?? null,
      /** "point": no grounds outline anywhere, so "borders" was judged from the campus point and is approximate. */
      grounds: sc?.grounds ?? null,
      zone: rp.zone, points: rp.n, shareOfZone: pct(rp.n, zones.find((z) => z.name === rp.zone).points),
      railNewlyPct: pct(rp.railNew, rp.n),
      streets: rows.filter((r) => r.points >= MIN_REQUEST_POINTS),
      smaller: rows.filter((r) => r.points < MIN_REQUEST_POINTS).map((r) => ({ name: r.name, points: r.points })),
    };
  });
writeFileSync(join(dataDir, "zone_requests.json"), JSON.stringify({
  generatedAt: totals.computedAt, streetContextAt: streetCtx?.fetchedAt ?? null, minPoints: MIN_REQUEST_POINTS, schools: zoneRequests,
}));

// ---- Shuttles: HISD's announced pairings, placed on campus points and OSM grounds ----
// HISD publishes no stop spot, so each end carries the grounds outline the stop is somewhere on.
const GROUNDS_MAX_M = 150;
const grounds = existsSync(join(dataDir, "campus_grounds.geojson"))
  ? (load("campus_grounds").features as any[]).map((f) => ({
      name: f.properties.name as string | null,
      polys: (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as LngLat[][][],
    }))
  : [];
if (!grounds.length) console.warn("No campus_grounds.geojson; run `npm run grounds`. Shuttles will have no outlines.");

/** Metres from a point to a ring's edges (equirectangular; fine at campus scale). */
function distToRing(p: LngLat, ring: LngLat[]) {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180), ky = 110540;
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - p[0]) * kx, ay = (ring[i - 1][1] - p[1]) * ky;
    const bx = (ring[i][0] - p[0]) * kx, by = (ring[i][1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
function groundsAt(p: LngLat) {
  let hit: { name: string | null; polys: LngLat[][][]; d: number } | null = null;
  for (const g of grounds) {
    const d = g.polys.some((rings) => pointInRings(p, rings)) ? 0 : Math.min(...g.polys.map((rings) => distToRing(p, rings[0])));
    if (d <= GROUNDS_MAX_M && (!hit || d < hit.d)) hit = { ...g, d };
  }
  return hit && { grounds: hit.polys, groundsName: hit.name, groundsOffsetM: Math.round(hit.d) };
}

const shuttles = SHUTTLE_PAIRS.map((pair) => {
  const o = ds.schoolsOld.get(pair.from);
  if (!o) throw new Error(`Shuttle pickup campus ${pair.from} is not in schools_old`);
  const from = { nbr: o.nbr, name: o.name, address: o.address, loc: o.loc, ...(groundsAt(o.loc) ?? { grounds: null, groundsName: null, groundsOffsetM: null }) };
  const to = pair.to.map((t) => {
    const s = ds.schoolsNew.get(t.nbr);
    if (!s) throw new Error(`Shuttle drop-off campus ${t.nbr} is not in schools_new`);
    return {
      nbr: s.nbr, name: t.label ?? s.name, address: s.address, loc: s.loc, grades: t.grades ?? null,
      miles: haversine(o.loc, s.loc) / METERS_PER_MILE,
      ...(groundsAt(s.loc) ?? { grounds: null, groundsName: null, groundsOffsetM: null }),
    };
  });
  // "Same site" when every drop-off is within 50 m of the pickup: no trip to make.
  return { from, to, sameSite: to.every((t) => t.miles * METERS_PER_MILE < 50), flags: pair.flags ?? [] };
});
writeFileSync(join(dataDir, "shuttles.json"), JSON.stringify({ sources: SHUTTLE_SOURCES, shuttles }));
for (const s of shuttles)
  console.log(`shuttle ${s.from.name.padEnd(28)} grounds ${s.from.grounds ? `${s.from.groundsName ?? "(unnamed)"} +${s.from.groundsOffsetM}m` : "none"}` +
    ` → ${s.to.map((t) => `${t.name} ${t.miles.toFixed(2)} mi`).join("; ")}`);

// ---- VERIFY.md: recomputed vs Report.md -------------------------------------

type Row = [claim: string, reported: string, recomputed: string, ok: boolean];
const rows: Row[] = [];
const f1 = (x: number) => x.toFixed(1);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const check = (claim: string, reported: number, got: number, tol: number, unit = "%") =>
  rows.push([claim, `${reported}${unit}`, `${f1(got)}${unit}`, near(reported, got, tol)]);

rows.push(["Elementary zones 2025–26 → 2026–27", "163 → 156", `${totals.zonesOld} → ${totals.zonesNew}`, totals.zonesOld === 163 && totals.zonesNew === 156]);
rows.push(["Campus points 2025–26 → 2026–27", "274 → 263", `${totals.schoolsOld} → ${totals.schoolsNew}`, totals.schoolsOld === 274 && totals.schoolsNew === 263]);
rows.push(["Sample points in the 7 closed zones (~110 m)", "1,844", String(allN), near(allN, 1844, 60)]);
rows.push(["Active railroad features in the Houston envelope", "1,036", String(meta.rail?.count), false]);

const byName = (s: string) => zones.find((z) => z.name.startsWith(s));
// Report.md, run-10 zone table: [median Δ m, % farther, % >2 mi from new campus]
const run10: Record<string, [string, number, number, number]> = {
  Alcott: ["Mading", 692, 100.0, 0.0], Briscoe: ["Carrillo", 493, 74.9, 0.0], Burrus: ["Kennedy", 1155, 97.2, 0.0],
  Franklin: ["Gallegos", 685, 100.0, 0.0], Henderson: ["Bruce", 1564, 100.0, 0.0],
  "Port Houston": ["Pleasantville", 994, 98.1, 0.0], Ross: ["Dogan", 1525, 98.8, 4.0],
};
// Report.md, run-12 table: [max mi, mean mi, % beyond 2 mi, % beyond 1.5 mi]
const run12: Record<string, [number, number, number, number]> = {
  Alcott: [1.28, 0.84, 0.0, 0.0], Briscoe: [1.43, 0.72, 0.0, 0.0], Burrus: [1.70, 1.12, 0.0, 7.8],
  Franklin: [1.35, 0.79, 0.0, 0.0], Henderson: [1.76, 1.31, 0.0, 26.0],
  "Port Houston": [1.92, 1.09, 0.0, 15.0], Ross: [2.69, 1.51, 17.8, 43.2],
};
for (const [k, [recv, dm, far, o2]] of Object.entries(run10)) {
  const z = byName(k);
  if (!z) { rows.push([`${k} ES zone present`, "closed", "not found", false]); continue; }
  const top = z.receiving[0];
  rows.push([`${k} → receiving campus`, `${recv} ES`, z.receiving.map((r: any) => `${r.name} ${f1(r.share)}%`).join(", "), top.name.startsWith(recv)]);
  rows.push([`${k}: median distance change`, `+${dm} m`, `${z.medianDeltaM >= 0 ? "+" : ""}${Math.round(z.medianDeltaM)} m`, near(dm, z.medianDeltaM, 100)]);
  check(`${k}: share of zone farther`, far, z.pctFarther, 3);
  check(`${k}: share >2 mi from new campus (run 10)`, o2, z.pctOver2New, 2);
  const [mx, mean, b2, b15] = run12[k];
  rows.push([`${k}: max / mean mi to new campus (run 12)`, `${mx} / ${mean}`, `${z.maxNewMi.toFixed(2)} / ${z.meanNewMi.toFixed(2)}`, near(mx, z.maxNewMi, 0.15) && near(mean, z.meanNewMi, 0.1)]);
  check(`${k}: share beyond 2 mi (run 12)`, b2, z.pctOver2New, 2);
  check(`${k}: share beyond 1.5 mi (run 12)`, b15, z.pctOver15New, 3);
}
const ross = byName("Ross");
if (ross) {
  const dogan = ross.receiving.find((r: any) => r.name.startsWith("Dogan"))?.share ?? 0;
  check("Ross → Dogan share", 86.9, dogan, 3);
}
check("All 7: ped-dangerous road crossed, old campus", 16.8, totals.hazardOld.ped, 2);
check("All 7: ped-dangerous road crossed, new campus", 40.1, totals.hazardNew.ped, 2);
check("All 7: any HIN road crossed, old", 27.9, totals.hazardOld.hin, 2);
check("All 7: any HIN road crossed, new", 67.4, totals.hazardNew.hin, 2);
check("All 7: active railroad crossed, old", 36.2, totals.hazardOld.rail, 2);
check("All 7: active railroad crossed, new", 56.5, totals.hazardNew.rail, 2);
check("All 7: ped-dangerous OR rail, old", 46.9, totals.hazardOld.combined, 2);
check("All 7: ped-dangerous OR rail, new", 79.5, totals.hazardNew.combined, 2);
check("All 7: share beyond 2 mi (run 12, area-weighted)", 3.2, totals.pctOver2New, 1);
check("All 7: share beyond 1.5 mi (run 12)", 15.3, totals.pctOver15New, 2);
const railClaims: [string, number, number][] = [["Port Houston", 55.6, 92.8], ["Franklin", 10.1, 100.0], ["Henderson", 42.3, 89.6]];
for (const [k, o, n] of railClaims) {
  const z = byName(k);
  if (!z) continue;
  check(`${k}: rail crossed, old`, o, z.hazardOld.rail, 3);
  check(`${k}: rail crossed, new`, n, z.hazardNew.rail, 3);
}
// Idea.md's 2026-09-25 shuttle table, from research/walk-checks-and-buses/burrus-rail-split.py.
const bs = railSplit.get("Burrus ES");
if (bs) {
  check("Burrus: active rail only on the walk to the shuttle pickup", 54.2, pct(bs.pickupOnly, bs.n), 1);
  check("Burrus: active rail only on the walk straight to Kennedy", 45.8, pct(bs.receivingOnly, bs.n), 1);
}
const reportedRoads: [string, number][] = [["LIBERTY RD", 279], ["WESTOVER ST", 185], ["BELLFORT", 121], ["RALSTON ST", 88],
  ["AIRLINE DR", 67], ["N MAIN ST", 55], ["N WAYSIDE DR", 36], ["COLLINGSWORTH ST", 34], ["MACARIO GARCIA", 29], ["MARTIN LUTHER KING", 27]];
// The brief ranks these as *newly* crossed, so that's the count checked. The corridor list holds every road the new
// walks cross, so a road crossed on both walks shows its counts instead of reading "not crossed".
const roadChecks = reportedRoads.map(([road, n]) => {
  const c = corridorList.find((x) => x.kind === "road" && x.key.includes(road));
  const ok = !!c && near(n, c.pointsNewlyCrossed, n * 0.15 + 5);
  rows.push([`Road newly crossed: ${road}`, `${n} pts`,
    c ? `${c.pointsNewlyCrossed} newly; ${c.pointsNewRoute} on the new walk, ${c.pointsNewRoute - c.pointsNewlyCrossed} of them also on the walk to the old campus` : "not crossed on the new walk",
    ok]);
  return { road, n, c, ok };
});
const reproduced = roadChecks.filter((r) => r.ok);
const higher = roadChecks.filter((r) => !r.ok && r.c && r.c.pointsNewlyCrossed > r.n);
// Crossed on the new walk, but mostly by points whose walk to the old campus crosses it too: not new.
const onBoth = roadChecks.filter((r) => !r.ok && r.c && r.c.pointsNewlyCrossed < r.c.pointsNewRoute / 2);
const roadName = (r: (typeof roadChecks)[number]) => r.c?.name ?? r.road;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// ---- The warning-families report's where-to-cross figures, recomputed with the app's own crossings.ts ----
const wfPct = (t: { points: number; anyRoadFar: number; anyRailFar: number }, k: "anyRoadFar" | "anyRailFar") => pct(t[k], t.points);
const WF = "warning-families:";
check(`${WF} points with a road crossing >250 m from a light, walk to the receiving school`, 42.3, wfPct(xAll.receiving, "anyRoadFar"), 2);
check(`${WF} same, walk to the shuttle pickup`, 12.6, wfPct(xAll.pickup, "anyRoadFar"), 2);
check(`${WF} points with a rail crossing >250 m from a public crossing, walk to the receiving school`, 27.1, wfPct(xAll.receiving, "anyRailFar"), 2);
check(`${WF} same, walk to the shuttle pickup`, 10.5, wfPct(xAll.pickup, "anyRailFar"), 2);
for (const [zone, k, v] of [["Burrus ES", "anyRoadFar", 93.8], ["Alcott ES", "anyRoadFar", 90.3], ["Port Houston ES", "anyRailFar", 85.3]] as const) {
  const z = xZone.get(zone);
  if (z) check(`${WF} ${zone}: points with a ${k === "anyRoadFar" ? "road crossing >250 m from a light" : "rail crossing >250 m from a public crossing"}, new walk`, v, wfPct(z.receiving, k), 2);
}
for (const road of ["E WHITNEY ST", "WESTOVER ST", "RALSTON ST", "BREWSTER ST"]) {
  const c = corridorList.find((x) => x.key === `road:${road}`);
  rows.push([`${WF} no light within 500 m of where the walks cross ${road}`, "0 lights", c ? `${c.control.controlsWithin500} lights` : "not crossed", c?.control.controlsWithin500 === 0]);
}
{
  const ph = corridorList.filter((x) => x.kind === "rail" && x.key.endsWith("@Port Houston ES"));
  const dsPh = ph.flatMap((x) => corridors.get(x.key)!.controlD).filter(Number.isFinite);
  const top = corridors.get("rail:Union Pacific Railroad Company@Port Houston ES");
  const nearestPh = top && [...top.nearestCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  rows.push([`${WF} Port Houston rail: median to a public crossing; most walks' nearest`, "586 m; Pleasantville Dr",
    `${Math.round(median(dsPh))} m; ${nearestPh ?? "none"}`, near(586, median(dsPh), 60) && nearestPh === "Pleasantville Dr"]);
}

// ---- The after-the-shuttle report's pickup-sites.md, recomputed as the April 15 page shows it ----
const reqRow = (school: string, road: string) => requestRows.find((r) => ds.schoolsNew.get(r.nbr)!.name === school && r.key === `road:${road}`);
check("pickup-sites.md: share of the Burrus zone whose walk to Kennedy newly crosses E Whitney St", 79.6, reqRow("Kennedy ES", "E WHITNEY ST")?.share ?? 0, 1);
check("pickup-sites.md: same, Crosstimbers St", 50.0, reqRow("Kennedy ES", "CROSSTIMBERS ST")?.share ?? 0, 1);

const agree = rows.filter((r) => r[3]).length;
const md = `# VERIFY — recomputed figures vs Report.md and the warning-families report

Generated by \`app/scripts/compute.ts\` on ${totals.computedAt.slice(0, 10)} from the snapshot fetched ${meta.fetchedAt.slice(0, 10)}.
Method: ~${SPACING_M} m grid inside each 2025–26 elementary zone with no 2026–27 counterpart; each point is
located in the 2025–26 and 2026–27 boundary layers, measured (haversine, straight line) to that year's campus
point, and the straight line is tested for crossings against the City's Ped Dangerous Roads (HIN 2022), the
High Injury Network 2022, and HISD's active Texas Railroads. **Shares are of zone area, not of students.**
Rows marked "warning-families:" check the where-to-cross figures in the site's warning-families report
(\`Reports/warning-families/crossing-data.md\`) with the app's own \`src/lib/crossings.ts\`, against the signal and
FRA crossing lists fetched ${meta.signals?.readOn ?? "(not yet)"} (\`npm run crossings\`).

**${agree} of ${rows.length} checks agree** within tolerance. ⚠️ rows are where the report and the data disagree —
the app shows only the recomputed number.

| Claim | Report.md | Recomputed | |
|---|---|---|:-:|
${rows.map(([c, r, g, ok]) => `| ${c} | ${r} | ${g} | ${ok ? "✅" : "⚠️"} |`).join("\n")}

## What the ⚠️ rows mean

- **Ross, run-12 figures (17.8% beyond 2 mi, max 2.69 mi) and the all-7 "3.2% beyond 2 mi".** Reproduced
  only by measuring the *entire* Ross zone to Dogan ES (18.3%, max 2.75 mi). The 2026–27 boundary layer sends
  ${f1(ross?.receiving.find((r: any) => r.name.startsWith("Roosevelt"))?.share ?? 0)}% of the old Ross zone to
  Roosevelt ES, so the correct figures are the run-10 ones: ~4% of Ross and **${f1(totals.pctOver2New)}% of all seven
  zones** beyond 2 miles. The report's run-12 table overstates distance eligibility; its central claim (the
  2-mile rule catches almost nobody) gets *stronger*.
- **Sample-point count and railroad feature count** differ with grid origin and envelope choice; they are
  method details, not findings. Every share they feed agrees.
- **The ranked road list.** ${list(reproduced.map(roadName))} reproduce; ${list(higher.map(roadName))} come out
  *higher*. ${list(onBoth.map((r) => `${roadName(r)} (${r.c!.zones.map((z) => z.replace(/ ES$/, "")).join(", ")}: ${r.c!.pointsNewRoute} points on the new walk, the brief's ${r.n})`))}
  are crossed on the new walk at counts close to the brief's, but ${onBoth.every((r) => r.c!.pointsNewlyCrossed === 0) ? "every one" : "nearly all"} of those points
  cross the same road on the walk to the old campus too, so they aren't *newly* crossed. The brief's list mixes
  "crossed on the new walk" with "newly crossed." **Corrected 2026-09-26:** earlier versions of this file said
  these roads weren't crossed at all and guessed they came from the Cage/Hobby zones. That came from this check
  searching only the newly-crossed list. **The app ranks by newly crossed** and shows the both-walks roads only
  when asked.
- **Not checked here:** the METRO stop counts (no GTFS in this build), the Cage/Hobby co-location figures (out of
  scope), and anything about who announced what.

## On-screen claims that aren't computed

The Lookup page and the packet also state these. None comes from the map layers, so each is checked against
its source instead. Re-check them before a demo; any can change.

| Claim on screen | Source | Checked |
|---|---|---|
| HISD's closure shuttle runs from the closed campus to the receiving campus for "K-12 students who are impacted by a school closure," in 2026–27 and 2027–28 | HISD news post, Feb 27, 2026; the walk-checks-and-buses report | 2026-09-25 |
| After the shuttle, general-education students get a bus only at 2 or more miles | HISD transportation eligibility page | 2026-09-25 |
| "Pre-K 4 and Pre-K 3 students are not eligible for transportation unless they are a student with an IEP/504 plan and receive transportation as a related service." | houstonisd.org/families-students/transportation (quoted in Idea.md) | 2026-09-25 |
| The family form is the Laserfiche "Transportation Support Request Form" (TSRFParent), with a "Walk Route Concerns" subcategory, one Description box, no upload, and a required student ID ("S" + 7 digits) | Rendered by research/measuring-the-request/hisd-request-forms.cjs; nothing submitted | 2026-09-25 |
| A principal starts a hazardous-route request for an area (CNA(EXHIBIT), Exhibit B; regulation CNA1, effective Aug 10, 2026) | pol.tasb.org, HISD policy key 592 | 2026-09-25 |
| HISD's pages give 5 to 10 business days for transportation requests | Request survey: "5-7 business days"; Transportation page and FAQ: 10 | 2026-09-25 |
| HISD's closure family line: 713-556-7121 | houstonisd.org/closure-resources | 2026-09-26 |
| For elementary students, a walk across train tracks counts as hazardous | Houston Landing, Dec 30, 2024. Reporting on HISD's process, not policy text, and the page says so | 2026-09-22 |
| Only a school's principal can apply for a City school zone; applications close April 15 | HPW School Coordination Program, eff. Sept 1, 2023 (after-the-shuttle report, pickup-sites.md) | 2026-09-26 |
| The City decides how many school crossing guards are needed | Tex. Local Gov't Code §343.014 (after-the-shuttle report) | 2026-09-26 |
| The City takes reports about its traffic signals through 311 | The TranStar signal feed's own contact field for every City signal ("311 or 311 Website") | 2026-09-26 |
| Crossing guards, stop signs and marked crosswalks aren't in any public Houston map layer | ArcGIS Online searches in the warning-families report | 2026-09-26 |
| Where-to-cross lines name the nearest signal on the crossed road, or the nearest open public FRA crossing on the crossed railroad; "near" is within ${NEAR_M} m of where the straight line crosses | \`src/lib/crossings.ts\`, ported from \`research/warning-families/crossing-options.mts\`. Fire-station signals are left out (${meta.signals?.fireSignalsDropped ?? "?"} in the area), and so are ${meta.rail_crossings?.facilityDriveways?.length ?? "?"} FRA "public" crossings whose names mark them as port or plant driveways ("Ship Channel Entrance", "J W PEAVY/BWC Main Entrance"), so figures can differ slightly from the report | 2026-09-26 |
| HPW considers a zone on a street that "borders the school", or on one that "does not border the school but is a thoroughfare or collector", with "observation or evidence of students walking or riding bicycles"; "the street must be owned by the City of Houston" | HPW School Coordination Program application (school_zone_application_08-2023.pdf) | 2026-09-26 |
| School zones are 20 mph, timed 45 min before to 15 min after take-up and 15 min before to 30 min after dismissal; the ordinance goes to Council each July | Same PDF | 2026-09-26 |
| The same form's crosswalk page: crosswalks only where there are ADA-compliant ramps; "a crossing-guard must be assigned at mid-block crossings serving elementary students" | Same PDF | 2026-09-26 |
| Signing the City's 2023 batch of 38 schools "will take about 11 months" | City Council TTI committee slides, Sept 7, 2023 (after-the-shuttle report) | 2026-09-26 |
| The closures were approved Feb 26, 2026, 48 days before that year's April 15 deadline | after-the-shuttle report, pickup-sites.md | 2026-09-26 |
| HISD's board declared all seven closed elementary buildings surplus on Aug 13, 2026 (9–0) and authorized "sales procedures, effective August 14, 2026"; no sale date is published | Legistar event 1304 minutes, printed by research/after-the-shuttle/shuttle-gaps.py | 2026-09-26 |
| Street class and owner come from the City's Major Thoroughfare and Freeway Plan at the crossing points; From/To and "borders the school" come from the City's road centerline | \`scripts/fetch-streets.ts\` (table below) | ${streetCtx ? new Date(streetCtx.fetchedAt).toLocaleDateString("en-CA") : "not run"} |

## April 15 page: which written path each street could use

From \`public/data/street_context.json\` (\`npm run streets\`). "Newly crossing" is the share of the area now zoned to
that school whose straight-line walk crosses the street when the walk to the old campus didn't. Lights are signals on
that street within 500 m of where the walks cross it. HPW decides eligibility after its own study; this only sorts.

| Receiving school | Street | Newly crossing | Lights ≤500 m | MTFP class / owner | Borders school | From → To | Path |
|---|---|---:|---:|---|:-:|---|---|
${zoneRequests.flatMap((z) => z.streets.map((r) => `| ${z.name} (${z.zone.replace(/ ES$/, "")}) | ${r.name} | ${f1(r.share)}% (${r.points} pts) | ${r.lights.within500} | ${r.streetClass?.type ? `${r.streetClass.type} / ${r.streetClass.owner ?? "?"}` : "not on the plan"} | ${r.borders ? (z.grounds === "point" ? "yes (approx.)" : "yes") : "no"} | ${r.limits ? `${r.limits.from ?? "?"} → ${r.limits.to ?? "?"}` : "—"} | ${r.path}${r.streetClass?.owner && r.streetClass.owner !== "COH" ? ` (owned by ${r.streetClass.owner}; HPW's form wants a City street)` : ""} |`)).join("\n")}


## Data vintages used
${["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"].map((k) => `- ${meta[k].label}: ${meta[k].count} features, last edited ${meta[k].lastEditDate}`).join("\n")}
${meta.signals ? `- ${meta.signals.label}: ${meta.signals.count} signals, read ${meta.signals.readOn} (the feed carries no date)` : "- Traffic signals: not fetched; run `npm run crossings`"}
${meta.rail_crossings ? `- ${meta.rail_crossings.label}: ${meta.rail_crossings.count} crossings, dataset updated ${meta.rail_crossings.lastEditDate}` : "- FRA crossings: not fetched; run `npm run crossings`"}
${meta.mtfp ? `- ${meta.mtfp.label}: ${meta.mtfp.count} lines pulled around the crossings, last edited ${meta.mtfp.lastEditDate}` : "- Major Thoroughfare Plan: not fetched; run `npm run streets`"}
${meta.centerline ? `- ${meta.centerline.label}: ${meta.centerline.count} pieces pulled around the crossings and schools, last edited ${meta.centerline.lastEditDate}` : "- Road centerline: not fetched; run `npm run streets`"}
`;
writeFileSync(join(import.meta.dirname, "..", "..", "VERIFY.md"), md);
console.log(`${zones.length} closed zones, ${allN} sample points, ${newlyCrossedCount} newly crossed corridors (${corridorList.length} crossed on the new walks)`);
console.log(`VERIFY: ${agree}/${rows.length} checks agree`);
