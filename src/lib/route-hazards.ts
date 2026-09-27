import type { Dataset, Hazard } from "./analyze";
import { haversine, type LngLat } from "./geo";

/** Inclusive non-collinear intersection: a route vertex at a crossing must not disappear. */
export function routeIntersection(a: LngLat, b: LngLat, c: LngLat, d: LngLat): LngLat | null {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const det = rx * sy - ry * sx;
  if (Math.abs(det) < 1e-18) return null; // parallel/overlapping travel is not a transverse crossing
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / det;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / det;
  if (t < -1e-8 || t > 1 + 1e-8 || u < -1e-8 || u > 1 + 1e-8) return null;
  return [a[0] + Math.max(0, Math.min(1, t)) * rx, a[1] + Math.max(0, Math.min(1, t)) * ry];
}

/** Same road/company grouping as the original analysis, ordered by FIRST encounter along the route.
 * These are potential intersections on a 2D map, not confirmed at-grade crossings.
 * Count each source feature once, even if many route segments touch it.
 */
export function hazardsOnPath(path: LngLat[], ds: Dataset): Hazard[] {
  const found = new Map<string, { hazard: Hazard; along: number; ids: Set<string>; ped: number[]; hin: number[] }>();
  let offset = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (const layer of ["rail", "pedHin", "hin"] as const) {
      for (const line of ds[layer]) {
        const bb = line.bbox;
        if (bb[2] < Math.min(a[0], b[0]) || bb[0] > Math.max(a[0], b[0]) ||
            bb[3] < Math.min(a[1], b[1]) || bb[1] > Math.max(a[1], b[1])) continue;
        for (const part of line.parts) for (let j = 1; j < part.length; j++) {
          const at = routeIntersection(a, b, part[j - 1], part[j]);
          if (!at) continue;
          const rail = layer === "rail";
          const p = line.props as unknown as Record<string, string | number>;
          const name = String(rail ? p.RR_COMPANY || "Railroad" : p.Full_Name || "Unnamed road").trim();
          const key = rail ? `rail:${name}` : `road:${name.toUpperCase()}`;
          const along = offset + haversine(a, at);
          let entry = found.get(key);
          if (!entry) {
            entry = { along, ids: new Set(), ped: [0, 0, 0], hin: [0, 0, 0], hazard: {
              key, kind: rail ? "rail" : "road", name: rail ? `Active railroad — ${name}` : name,
              pedDangerous: false, highInjury: false, pedCrashes: 0, pedDeaths: 0, totalCrashes: 0, at, lineIds: [],
            } };
            found.set(key, entry);
          }
          if (along < entry.along) { entry.along = along; entry.hazard.at = at; }
          const id = `${layer}:${line.id}`;
          if (entry.ids.has(id)) continue;
          entry.ids.add(id);
          entry.hazard.lineIds.push({ layer, id: line.id });
          if (!rail) {
            entry.hazard.pedDangerous ||= layer === "pedHin";
            entry.hazard.highInjury ||= layer === "hin";
            const counts = layer === "pedHin" ? entry.ped : entry.hin;
            counts[0] += Number(p.ped_crash_count) || 0;
            counts[1] += Number(p.ped_death_count) || 0;
            counts[2] += Number(p.total_crash_count) || 0;
          }
        }
      }
    }
    offset += haversine(a, b);
  }
  return [...found.values()].sort((a, b) => a.along - b.along).map(({ hazard, ped, hin }) => ({
    ...hazard, pedCrashes: Math.max(ped[0], hin[0]), pedDeaths: Math.max(ped[1], hin[1]), totalCrashes: Math.max(ped[2], hin[2]),
  }));
}
