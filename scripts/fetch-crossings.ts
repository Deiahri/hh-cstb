// Pulls the two public lists the walk plan uses to say where to cross, into public/data, and records them in
// meta.json:
//   - traffic signals (City of Houston, TxDOT, Harris County) as served to Houston TranStar's public signal map
//     (traffic.houstontranstar.org/signalmap/, GetSignals.asmx, no key) → signals.json;
//   - open railroad crossings in Harris County from FRA's Crossing Inventory (Form 71, data.transportation.gov
//     dataset m2f8-22s6, no key) → rail_crossings.json.
// Same sources and fields as research/warning-families/crossing-options.mts. Separate from fetch-data.ts so the
// HISD/City snapshot isn't re-pulled: `npm run crossings`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LngLat } from "../src/lib/geo";

const dataDir = join(import.meta.dirname, "..", "public", "data");
// Same Houston-area envelope fetch-data.ts clips statewide layers to.
const [W, S, E, N] = [-95.95, 29.45, -94.95, 30.15];
const inEnvelope = ([x, y]: LngLat) => x >= W && x <= E && y >= S && y <= N;

const TRANSTAR = "https://traffic.houstontranstar.org/signalmap/GetSignals.asmx/";
const FEEDS = [["GetCohSignals", "City of Houston"], ["GetTxDOTSignalsTAMS", "TxDOT"], ["GetHcSignals", "Harris County"]] as const;

async function transtar(fn: string, src: string) {
  const r = await fetch(TRANSTAR + fn, {
    method: "POST", body: "{}",
    headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`${fn}: HTTP ${r.status}`);
  const d = (await r.json()).d as any[];
  return d.map((s) => ({ src, name: String(s.Location ?? "").trim(), type: String(s.Type ?? ""), loc: [Number(s.Longitude), Number(s.Latitude)] as LngLat }));
}

// A fire-station signal stops traffic only for the trucks leaving the station, so it isn't a place to cross.
const isFireSignal = (s: { name: string; type: string }) => /fire/i.test(s.type) || /fire station/i.test(s.name);

const FRA = "https://data.transportation.gov/resource/m2f8-22s6.json";
const FRA_VIEW = "https://data.transportation.gov/api/views/m2f8-22s6.json";

async function fraCrossings() {
  const q = new URLSearchParams({
    $select: "crossingid,latitude,longitude,street,railroadname,crossingtype,crossingpurpose,crossingposition,countroadwaygatearms,countpedestriangatearms,countflashinglightpair,countmastmountedflashinglight",
    $where: "countyname='HARRIS' AND crossingclosed='No'",
    $limit: "5000",
  });
  const r = await fetch(`${FRA}?${q}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`FRA: HTTP ${r.status}`);
  const n = (v: any) => Number(v ?? 0) || 0;
  return ((await r.json()) as any[]).map((c) => ({
    id: String(c.crossingid), street: String(c.street ?? "").trim(), railroad: String(c.railroadname ?? ""),
    type: String(c.crossingtype ?? ""), purpose: String(c.crossingpurpose ?? ""), position: String(c.crossingposition ?? ""),
    gates: n(c.countroadwaygatearms), pedGates: n(c.countpedestriangatearms),
    flashers: n(c.countflashinglightpair) + n(c.countmastmountedflashinglight),
    loc: [Number(c.longitude), Number(c.latitude)] as LngLat,
  }));
}

const fetchedAt = new Date().toISOString();
// The date a Houston reader would call "today": fetchedAt is UTC, which is already tomorrow after 7pm CDT.
const readOn = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const valid = (loc: LngLat) => Number.isFinite(loc[0]) && Number.isFinite(loc[1]) && loc[0] !== 0;

const feeds = await Promise.all(FEEDS.map(([fn, src]) => transtar(fn, src)));
const all = feeds.flat().filter((s) => valid(s.loc) && inEnvelope(s.loc));
const fire = all.filter(isFireSignal);
const signals = all.filter((s) => !isFireSignal(s)).map(({ src, name, loc }) => ({ src, name, loc }));
writeFileSync(join(dataDir, "signals.json"), JSON.stringify(signals));

const xings = (await fraCrossings()).filter((c) => valid(c.loc));
// The walk plan only points to crossings anyone may use. Private crossings stay out, and so do "public" crossings
// whose FRA street name says they're a driveway into a port or plant ("J W PEAVY/BWC Main Entrance",
// "Ship Channel Entrance", "POHA INTERIOR CROSSINGS", "Gate 1 Rd", "MANCHESTER STREET/Yard Lead").
const FACILITY = /\b(entrance|interior|yard lead)\b|\bgate\s*\d|\/\s*(bwc|sesco)\b/i;
const facility = xings.filter((c) => c.type === "Public" && FACILITY.test(c.street));
const publicXings = xings.filter((c) => c.type === "Public" && !FACILITY.test(c.street));
writeFileSync(join(dataDir, "rail_crossings.json"), JSON.stringify(publicXings));
const view = await fetch(FRA_VIEW, { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null), () => null);
const fraUpdated = view?.rowsUpdatedAt ? new Date(view.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : null;

const metaPath = join(dataDir, "meta.json");
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
meta.signals = {
  label: "Traffic signals (City of Houston, TxDOT, Harris County, via Houston TranStar's signal map)",
  url: "https://traffic.houstontranstar.org/signalmap/",
  count: signals.length,
  // The feed carries no date; the date that matters is when it was read.
  lastEditDate: null,
  fetchedAt,
  readOn,
  bySource: Object.fromEntries(FEEDS.map(([, src]) => [src, signals.filter((s) => s.src === src).length])),
  fireSignalsDropped: fire.length,
};
meta.rail_crossings = {
  label: "FRA Crossing Inventory: open public crossings, Harris County",
  url: "https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6",
  count: publicXings.length,
  lastEditDate: fraUpdated,
  fetchedAt,
  readOn,
  openInHarris: xings.length,
  facilityDriveways: facility.map((c) => `${c.id} ${c.street}`),
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2));

console.log(`signals        ${String(signals.length).padStart(5)} (${FEEDS.map(([, src]) => `${src} ${meta.signals.bySource[src]}`).join(", ")}; ${fire.length} fire signals dropped)`);
console.log(`rail_crossings ${String(publicXings.length).padStart(5)} public of ${xings.length} open in Harris (${facility.length} facility driveways left out); FRA updated ${fraUpdated}`);
