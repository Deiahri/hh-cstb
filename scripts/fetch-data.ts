// Pulls every public layer the app uses into public/data as GeoJSON (WGS84),
// plus meta.json recording each layer's source URL and last-edit date.
// Rerun to refresh the snapshot: `npm run data`.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HISD = "https://services7.arcgis.com/YNiGsHEfQPYkIqX5/arcgis/rest/services";
const COH = "https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services";
// Houston-area envelope (lon/lat) used to clip statewide layers.
const ENVELOPE = "-95.95,29.45,-94.95,30.15";

type LayerSpec = {
  key: string;
  label: string;
  url: string;
  outFields: string;
  where?: string;
  envelope?: boolean;
};

const LAYERS: LayerSpec[] = [
  { key: "schools_old", label: "HISD Schools 2025–26", url: `${HISD}/HISD_Schools/FeatureServer/6`,
    outFields: "Campus_Nbr,Campus_Sho,Street_Add,Grades_Tau,Division" },
  { key: "schools_new", label: "HISD Schools 2026–27", url: `${HISD}/HISD_Schools_2026_2027/FeatureServer/1`,
    outFields: "Campus_Nbr,Campus_Sho,Street_Add,Grades_Tau,Division,Former_Nam,School_Level" },
  { key: "zones_old", label: "Elementary boundaries 2025–26", url: `${HISD}/Elementary_School_Boundaries_2024_2025/FeatureServer/0`,
    outFields: "Campus__Number,Campus_Short_Name,Street_Address" },
  { key: "zones_new", label: "Elementary boundaries 2026–27", url: `${HISD}/Elementary_School_Boundaries_2026_2027/FeatureServer/1`,
    outFields: "Campus__Number,Campus_Short_Name,Street_Address" },
  // NB: "Rainroads" is HISD's own spelling in the service URL.
  { key: "rail", label: "Texas Railroads (active)", url: `${HISD}/Texas_Rainroads/FeatureServer/0`,
    outFields: "RR_COMPANY,RR_ABRVN,RR_STATUS", where: "RR_STATUS='Active'", envelope: true },
  { key: "ped_hin", label: "Vision Zero Ped Dangerous Roads (HIN 2022)",
    url: `${COH}/COH_Vision_Zero_Ped_Dangerous_Roads_(HIN_2022)_view/FeatureServer/23`,
    outFields: "Full_Name,ped_crash_count,ped_death_count,total_crash_count,MilesLength" },
  { key: "hin", label: "Vision Zero High Injury Network 2022",
    url: `${COH}/COH_Vision_Zero_High_Injury_Network_2022_view/FeatureServer/19`,
    outFields: "Full_Name,ped_crash_count,ped_death_count,total_crash_count,MilesLength" },
];

async function getJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(JSON.stringify(body.error));
      return body;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}\n  ${e}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchLayer(spec: LayerSpec) {
  const info = await getJson(`${spec.url}?f=json`);
  const pageSize = Math.min(info.maxRecordCount ?? 1000, 2000);
  const features: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const p = new URLSearchParams({
      where: spec.where ?? "1=1",
      outFields: spec.outFields,
      outSR: "4326",
      geometryPrecision: "6",
      orderByFields: info.objectIdField ?? "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: "geojson",
    });
    if (spec.envelope) {
      p.set("geometry", ENVELOPE);
      p.set("geometryType", "esriGeometryEnvelope");
      p.set("inSR", "4326");
      p.set("spatialRel", "esriSpatialRelIntersects");
    }
    const page = await getJson(`${spec.url}/query?${p}`);
    features.push(...page.features);
    const more = page.exceededTransferLimit || page.properties?.exceededTransferLimit;
    if (!more || page.features.length === 0) break;
  }
  const lastEdit = info.editingInfo?.lastEditDate ?? info.editingInfo?.dataLastEditDate;
  return {
    geojson: { type: "FeatureCollection", features },
    meta: {
      label: spec.label,
      url: spec.url,
      count: features.length,
      lastEditDate: lastEdit ? new Date(lastEdit).toISOString().slice(0, 10) : null,
    },
  };
}

const outDir = join(import.meta.dirname, "..", "public", "data");
mkdirSync(outDir, { recursive: true });
const meta: Record<string, unknown> = { fetchedAt: new Date().toISOString() };
for (const spec of LAYERS) {
  const { geojson, meta: m } = await fetchLayer(spec);
  writeFileSync(join(outDir, `${spec.key}.geojson`), JSON.stringify(geojson));
  meta[spec.key] = m;
  console.log(`${spec.key.padEnd(12)} ${String(m.count).padStart(5)} features  last edit ${m.lastEditDate}`);
}
writeFileSync(join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
