// Recomputes every closure-zone figure from the snapshot in public/data and
// writes zones.json + corridors.json + shuttles.json for the app, and ../VERIFY.md comparing
// the recomputed numbers against the claims in ../Report.md.
// Run after `npm run data`: `npm run compute`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LngLat, METERS_PER_MILE, haversine, pointInRings, polygonAt } from "../src/lib/geo";
import { type Hazard, type RawData, analyzeAddress, buildDataset, flags } from "../src/lib/analyze";
import { SHUTTLE_PAIRS, SHUTTLE_SOURCES } from "./shuttle-pairs";

const dataDir = join(import.meta.dirname, "..", "public", "data");
const load = (k: string) => JSON.parse(readFileSync(join(dataDir, `${k}.geojson`), "utf8"));
const raw: RawData = {
  schools_old: load("schools_old"), schools_new: load("schools_new"),
  zones_old: load("zones_old"), zones_new: load("zones_new"),
  rail: load("rail"), ped_hin: load("ped_hin"), hin: load("hin"),
};
const ds = buildDataset(raw);
const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));

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
  zones: Set<string>; segs: Map<string, { layer: string; id: number }>;
}
const corridors = new Map<string, CorridorAcc>();
function corridor(h: Hazard): CorridorAcc {
  let c = corridors.get(h.key);
  if (!c) {
    c = { key: h.key, kind: h.kind, name: h.name, pedDangerous: false, highInjury: false,
      pointsNewRoute: 0, pointsOldRoute: 0, pointsNewlyCrossed: 0, zones: new Set(), segs: new Map() };
    corridors.set(h.key, c);
  }
  c.pedDangerous ||= h.pedDangerous;
  c.highInjury ||= h.highInjury;
  return c;
}

const zones: any[] = [];
// Per zone: sample points whose active-rail crossing is only on the walk to the closed campus (the shuttle pickup)
// or only on the walk to the 2026–27 campus. The Lookup page's two walks show this split address by address.
const railSplit = new Map<string, { pickupOnly: number; receivingOnly: number; n: number }>();
const allOld = emptyTally(), allNew = emptyTally();
let allN = 0, allOver2 = 0, allOver15 = 0;

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
      for (const h of r.old.hazards) corridor(h).pointsOldRoute++;
      for (const h of r.now.hazards) {
        const c = corridor(h);
        c.pointsNewRoute++;
        c.zones.add(name);
        if (!oldKeys.has(h.key)) c.pointsNewlyCrossed++;
        for (const l of h.lineIds) c.segs.set(`${l.layer}:${l.id}`, l);
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
  };
}).filter((c) => c.pointsNewlyCrossed > 0).sort((a, b) => b.pointsNewlyCrossed - a.pointsNewlyCrossed);

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
for (const [road, n] of reportedRoads) {
  const c = corridorList.find((x) => x.key.includes(road));
  rows.push([`Road newly crossed: ${road}`, `${n} pts`, c ? `${c.pointsNewlyCrossed} newly / ${c.pointsNewRoute} on new route` : "not crossed", !!c && (near(n, c.pointsNewlyCrossed, n * 0.15 + 5) || near(n, c.pointsNewRoute, n * 0.15 + 5))]);
}

const agree = rows.filter((r) => r[3]).length;
const md = `# VERIFY — recomputed figures vs Report.md

Generated by \`app/scripts/compute.ts\` on ${totals.computedAt.slice(0, 10)} from the snapshot fetched ${meta.fetchedAt.slice(0, 10)}.
Method: ~${SPACING_M} m grid inside each 2025–26 elementary zone with no 2026–27 counterpart; each point is
located in the 2025–26 and 2026–27 boundary layers, measured (haversine, straight line) to that year's campus
point, and the straight line is tested for crossings against the City's Ped Dangerous Roads (HIN 2022), the
High Injury Network 2022, and HISD's active Texas Railroads. **Shares are of zone area, not of students.**

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
- **The ranked road list.** Liberty Rd, Westover St and Ralston St reproduce; Bellfort St and Collingsworth St
  come out *higher*; Airline Dr, N Main St, SSgt Macario Garcia Dr and Martin Luther King Blvd exist in the City
  layers but no straight line from the seven closed zones to their 2026–27 campus crosses them. They likely came
  from the Cage/Hobby co-location zones, which the report measured separately. **The app uses the recomputed list.**
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

## Data vintages used
${["schools_old", "schools_new", "zones_old", "zones_new", "rail", "ped_hin", "hin"].map((k) => `- ${meta[k].label}: ${meta[k].count} features, last edited ${meta[k].lastEditDate}`).join("\n")}
`;
writeFileSync(join(import.meta.dirname, "..", "..", "VERIFY.md"), md);
console.log(`${zones.length} closed zones, ${allN} sample points, ${corridorList.length} newly crossed corridors`);
console.log(`VERIFY: ${agree}/${rows.length} checks agree`);
