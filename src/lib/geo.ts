// Minimal geometry, shared by the precompute scripts and the browser app.
// Coordinates are GeoJSON order: [lon, lat]. Over a few miles, planar tests
// in lon/lat are accurate enough for "does this straight line cross that road".

export type LngLat = [number, number];
export type BBox = [number, number, number, number]; // minX, minY, maxX, maxY

export interface Feature<P = Record<string, any>> {
  type: "Feature";
  properties: P;
  geometry: { type: string; coordinates: any } | null;
}
export interface FeatureCollection<P = Record<string, any>> {
  type: "FeatureCollection";
  features: Feature<P>[];
}

const R = 6371008.8; // metres
export const METERS_PER_MILE = 1609.344;

export function haversine(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rings of a Polygon/MultiPolygon, flattened. Even-odd across all rings handles holes. */
export function polygonRings(geom: Feature["geometry"]): LngLat[][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type === "MultiPolygon") return geom.coordinates.flat();
  return [];
}

/** Line parts of a LineString/MultiLineString. */
export function lineParts(geom: Feature["geometry"]): LngLat[][] {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  return [];
}

export function bboxOf(parts: LngLat[][]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const part of parts)
    for (const [x, y] of part) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

export function pointInRings(pt: LngLat, rings: LngLat[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function orient(a: LngLat, b: LngLat, c: LngLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Proper or touching intersection of segments p1p2 and q1q2. */
export function segmentsIntersect(p1: LngLat, p2: LngLat, q1: LngLat, q2: LngLat): boolean {
  const d1 = orient(q1, q2, p1);
  const d2 = orient(q1, q2, p2);
  const d3 = orient(p1, p2, q1);
  const d4 = orient(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Where segment p1p2 crosses q1q2 (assumes they intersect). */
export function intersectionPoint(p1: LngLat, p2: LngLat, q1: LngLat, q2: LngLat): LngLat {
  const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
  const t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}

// ---- Indexed layers --------------------------------------------------------

export interface IndexedPolygon<P> { props: P; rings: LngLat[][]; bbox: BBox; feature: Feature<P> }
export interface IndexedLine<P> { id: number; props: P; parts: LngLat[][]; bbox: BBox; feature: Feature<P> }

export function indexPolygons<P>(fc: FeatureCollection<P>): IndexedPolygon<P>[] {
  return fc.features.map((f) => {
    const rings = polygonRings(f.geometry);
    return { props: f.properties, rings, bbox: bboxOf(rings), feature: f };
  });
}

export function indexLines<P>(fc: FeatureCollection<P>): IndexedLine<P>[] {
  return fc.features.map((f, id) => {
    const parts = lineParts(f.geometry);
    return { id, props: f.properties, parts, bbox: bboxOf(parts), feature: f };
  });
}

export function polygonAt<P>(pt: LngLat, polys: IndexedPolygon<P>[]): IndexedPolygon<P> | undefined {
  return polys.find(
    (p) => pt[0] >= p.bbox[0] && pt[0] <= p.bbox[2] && pt[1] >= p.bbox[1] && pt[1] <= p.bbox[3] && pointInRings(pt, p.rings),
  );
}

export interface Crossing<P> { line: IndexedLine<P>; at: LngLat }

/** Every line feature the straight segment a→b crosses, with the first crossing point for each. */
export function crossings<P>(a: LngLat, b: LngLat, lines: IndexedLine<P>[]): Crossing<P>[] {
  const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
  const out: Crossing<P>[] = [];
  for (const line of lines) {
    const bb = line.bbox;
    if (bb[2] < minX || bb[0] > maxX || bb[3] < minY || bb[1] > maxY) continue;
    hit: for (const part of line.parts)
      for (let i = 1; i < part.length; i++)
        if (segmentsIntersect(a, b, part[i - 1], part[i])) {
          out.push({ line, at: intersectionPoint(a, b, part[i - 1], part[i]) });
          break hit;
        }
  }
  return out;
}
