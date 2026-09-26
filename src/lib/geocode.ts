// Keyless ArcGIS World Geocoding Service. Searches are limited to the Houston area.
import type { LngLat } from "./geo";

const BASE = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
const HOUSTON_EXTENT = JSON.stringify({ xmin: -95.95, ymin: 29.45, xmax: -94.95, ymax: 30.15, spatialReference: { wkid: 4326 } });

export interface Candidate { address: string; loc: LngLat; score: number }

export async function geocode(q: string): Promise<Candidate[]> {
  const p = new URLSearchParams({
    SingleLine: q, f: "json", outFields: "Match_addr", maxLocations: "5",
    searchExtent: HOUSTON_EXTENT, location: "-95.37,29.76", countryCode: "USA",
  });
  const r = await fetch(`${BASE}/findAddressCandidates?${p}`);
  if (!r.ok) throw new Error(`Geocoder HTTP ${r.status}`);
  const j = await r.json();
  return (j.candidates ?? [])
    .filter((c: any) => c.score >= 80)
    .map((c: any) => ({ address: c.address, loc: [c.location.x, c.location.y] as LngLat, score: c.score }));
}

export async function reverseGeocode(loc: LngLat): Promise<string | null> {
  const p = new URLSearchParams({ location: `${loc[0]},${loc[1]}`, f: "json", featureTypes: "StreetInt,PointAddress,StreetAddress" });
  try {
    const r = await fetch(`${BASE}/reverseGeocode?${p}`);
    const j = await r.json();
    return j.address?.Match_addr ?? j.address?.LongLabel ?? null;
  } catch {
    return null;
  }
}
