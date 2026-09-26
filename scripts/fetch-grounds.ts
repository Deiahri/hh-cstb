// Pulls OpenStreetMap school-grounds outlines around every shuttle endpoint into
// public/data/campus_grounds.geojson, and records the pull in meta.json. HISD
// publishes campus points only, and not where on campus a shuttle stops, so the
// app shows the grounds the stop is somewhere on. Separate from fetch-data.ts
// so the HISD/City snapshot isn't re-pulled: `npm run grounds`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LngLat } from "../src/lib/geo";
import { SHUTTLE_PAIRS } from "./shuttle-pairs";

// The main Overpass server returns 504 under load; try it, then a mirror, with backoff.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const RADIUS_M = 150;

const dataDir = join(import.meta.dirname, "..", "public", "data");
const points = (k: string) => {
  const fc = JSON.parse(readFileSync(join(dataDir, `${k}.geojson`), "utf8"));
  return new Map<number, LngLat>(fc.features.map((f: any) => [Number(f.properties.Campus_Nbr), f.geometry.coordinates]));
};
const oldPts = points("schools_old"), newPts = points("schools_new");
const ends: LngLat[] = SHUTTLE_PAIRS.flatMap((p) => [oldPts.get(p.from), ...p.to.map((t) => newPts.get(t.nbr))])
  .filter((x): x is LngLat => !!x);

const tag = `["amenity"~"^(school|kindergarten)$"]`;
const query = `[out:json][timeout:90];(${ends
  .map(([x, y]) => `way(around:${RADIUS_M},${y},${x})${tag};relation(around:${RADIUS_M},${y},${x})${tag};`)
  .join("")});out meta geom;`;

async function overpass(q: string): Promise<any[]> {
  const errors: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "closed-school-walk-check/0.1" },
        body: new URLSearchParams({ data: q }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).elements;
    } catch (e) {
      errors.push(`${url}: ${e}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`Overpass failed:\n  ${errors.join("\n  ")}`);
}
const elements = await overpass(query);

const ring = (geom: { lat: number; lon: number }[]): LngLat[] => geom.map((g) => [g.lon, g.lat]);
const closed = (r: LngLat[]) => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];

const features = elements.flatMap((e) => {
  // Relations: keep each closed outer member as its own ring; unjoined pieces are skipped.
  const rings = e.type === "way"
    ? [ring(e.geometry)]
    : (e.members ?? []).filter((m: any) => m.role === "outer" && m.geometry).map((m: any) => ring(m.geometry));
  const polys = rings.filter(closed).map((r: LngLat[]) => [r]);
  if (!polys.length) return [];
  return [{
    type: "Feature",
    properties: { osm: `${e.type}/${e.id}`, name: e.tags?.name ?? null, amenity: e.tags.amenity, timestamp: e.timestamp },
    geometry: polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys },
  }];
});

writeFileSync(join(dataDir, "campus_grounds.geojson"), JSON.stringify({ type: "FeatureCollection", features }));
const lastEdit = features.map((f) => f.properties.timestamp as string).sort().at(-1);
const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));
meta.campus_grounds = {
  label: "OpenStreetMap school grounds",
  url: "https://www.openstreetmap.org/copyright",
  count: features.length,
  lastEditDate: lastEdit ? lastEdit.slice(0, 10) : null,
  fetchedAt: new Date().toISOString(),
};
writeFileSync(join(dataDir, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`campus_grounds ${features.length} polygons around ${ends.length} shuttle endpoints, newest edit ${meta.campus_grounds.lastEditDate}`);
