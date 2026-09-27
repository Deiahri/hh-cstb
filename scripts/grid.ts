// The ~110 m sample grid over the seven closed zones, point for point the one compute.ts walks, for scripts that
// need the same walks without recomputing every zone figure (fetch-streets.ts).
import { type AddressResult, type Dataset, type RouteResult, type ZoneProps, analyzeAddress } from "../src/lib/analyze";
import { type IndexedPolygon, type LngLat, pointInRings } from "../src/lib/geo";

export const SPACING_M = 110;
/** A (receiving school, newly crossed road) pair needs this many sample points to get a row on the April 15 page. */
export const MIN_REQUEST_POINTS = 10;

export type Sample = AddressResult & { old: RouteResult; now: RouteResult };

/** Every grid point inside a closed 2025–26 zone that has a school in both years. */
export function forEachSample(ds: Dataset, visit: (zone: IndexedPolygon<ZoneProps>, pt: LngLat, r: Sample) => void) {
  for (const zone of ds.zonesOld.filter((z) => ds.closedIds.has(Number(z.props.Campus__Number)))) {
    const [minX, minY, maxX, maxY] = zone.bbox;
    const midLat = (minY + maxY) / 2;
    const dLat = SPACING_M / 111320;
    const dLon = SPACING_M / (111320 * Math.cos((midLat * Math.PI) / 180));
    for (let y = minY + dLat / 2; y < maxY; y += dLat) {
      for (let x = minX + dLon / 2; x < maxX; x += dLon) {
        const pt: LngLat = [x, y];
        if (!pointInRings(pt, zone.rings)) continue;
        const r = analyzeAddress(pt, ds);
        if (r.old && r.now) visit(zone, pt, r as Sample);
      }
    }
  }
}
