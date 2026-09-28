// Live conditions on the walk: the City of Houston's Train Watch rail-crossing sensors, read in the browser and by the
// logger and agent scripts. Pure functions plus one fetch, so `npm test` covers the parsing and the bell-time math.
//
// Train Watch (houstontx.gov/trainwatch) is an ArcGIS Online feature layer the City refreshes about every 30 seconds.
// No key. Each feature's `code` is the crossing's FRA inventory id, the same id rail_crossings.json uses, so a
// sensor joins to a walk's rail crossing without any geometry matching.
import type { Dataset, Hazard } from "./analyze";
import { SHOW_FAR_M, type RailXing, crossingsOnTrack, railKind } from "./crossings";
import { type LngLat, haversine } from "./geo";

export const TRAIN_WATCH_LAYER =
  "https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services/Train_Watch_Layer/FeatureServer/0";
export const TRAIN_WATCH_PAGE = "https://www.houstontx.gov/trainwatch/";
/** The City's own map refreshes at 0.5 min; polling faster adds load and no information. */
export const POLL_MS = 30_000;

/** One Train Watch sensor, as snapshotted to public/data/trainwatch.json. */
export interface TwSensor {
  /** FRA crossing id (Train Watch `code`). */
  id: string;
  street: string;
  /** Train Watch `sensorType`: "V" and "T" are the two kinds the layer uses; the City doesn't publish what they mean. */
  sensorType: string;
  loc: LngLat;
}
export interface TrainWatchSnapshot { fetchedAt: string; source: string; sensors: TwSensor[] }

/** The live state of one sensor. */
export interface TwStatus {
  id: string;
  street: string;
  loc: LngLat;
  blocked: boolean;
  /** Train Watch `sensorStatus`. "DOWN" is common on sensors that are otherwise reporting, so it's shown, not trusted. */
  sensorStatus: string | null;
  /** When the current blockage began (epoch ms), if blocked. */
  startMs: number | null;
  /** The City's estimate, as it gives it ("7 MIN"). */
  timeToClear: string | null;
  /** Train Watch `timeUpdated`, parsed from its "[y,m,d,h,mi,s]" UTC string. */
  updatedMs: number | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "[2026,9,27,19,24,59]" (UTC, month 1-based, trailing parts optional) → epoch ms. */
export function parseTwTime(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^\[(\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}))?(?:,(\d{1,2}))?(?:,(\d{1,2}))?\]$/);
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", se = "0"] = m.slice(1).map((x) => x ?? "0");
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
}

/** An ArcGIS query response (f=json, outSR=4326) → statuses. Unknown shapes give an empty list, never a throw. */
export function parseTrainWatch(json: any): TwStatus[] {
  const feats: any[] = Array.isArray(json?.features) ? json.features : [];
  return feats.flatMap((f) => {
    const a = f?.attributes ?? {};
    const x = num(f?.geometry?.x), y = num(f?.geometry?.y);
    if (!a.code || x === null || y === null) return [];
    const blocked = String(a.crossingStatus ?? "").toLowerCase() === "blocked";
    return [{
      id: String(a.code), street: String(a.street ?? ""), loc: [x, y] as LngLat, blocked,
      sensorStatus: a.sensorStatus ? String(a.sensorStatus) : null,
      startMs: blocked ? num(a.startTime) : null,
      timeToClear: blocked && a.timeToClear ? String(a.timeToClear) : null,
      updatedMs: parseTwTime(a.timeUpdated),
    }];
  });
}

export const trainWatchQuery = (fields = "code,street,crossingStatus,sensorStatus,sensorType,startTime,timeToClear,timeUpdated") =>
  `${TRAIN_WATCH_LAYER}/query?${new URLSearchParams({ where: "1=1", outFields: fields, outSR: "4326", f: "json" })}`;

/** One read of the live layer. The layer serves CORS, so the browser calls it directly: no proxy, no key. */
export async function fetchTrainWatch(signal?: AbortSignal): Promise<{ at: number; statuses: TwStatus[] }> {
  const r = await fetch(trainWatchQuery(), { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Train Watch: HTTP ${r.status}`);
  const json = await r.json();
  if (json?.error) throw new Error(`Train Watch: ${json.error.message ?? "error"}`);
  return { at: Date.now(), statuses: parseTrainWatch(json) };
}

// ---- Which sensor speaks for a walk's rail crossing ------------------------------------------------------------------

/** Grade-separated crossings (the street goes over or under) can't be blocked by a train. */
export const canBlock = (x: RailXing) => !["underpass", "bridge"].includes(railKind(x));

export interface WalkSensor { sensor: TwSensor; xing: RailXing; d: number }

/**
 * The Train Watch sensor on the same track as a walk's rail crossing: the monitored public crossing of that track
 * nearest to where the walk meets it, within SHOW_FAR_M. Null for roads, or when no crossing nearby has a sensor.
 */
export function sensorForHazard(h: Pick<Hazard, "kind" | "key" | "at">, ds: Dataset, sensors: Map<string, TwSensor>): WalkSensor | null {
  if (h.kind !== "rail" || !sensors.size) return null;
  let best: WalkSensor | null = null;
  for (const x of crossingsOnTrack(ds, h.key)) {
    const s = sensors.get(x.id);
    if (!s) continue;
    const d = haversine(h.at, x.loc);
    if (d <= SHOW_FAR_M && (!best || d < best.d)) best = { sensor: s, xing: x, d };
  }
  return best;
}

// ---- Bell times ------------------------------------------------------------------------------------------------------

/**
 * The windows the logger watches, Houston time, Monday to Friday. HISD elementary bell times vary by campus and aren't
 * in any public layer, so these are wide on purpose; set BELL_WINDOWS per school once the times are confirmed.
 */
export const BELL_WINDOWS = [
  { key: "am", from: "06:45", to: "08:30" },
  { key: "pm", from: "14:30", to: "16:30" },
] as const;
export type BellKey = (typeof BELL_WINDOWS)[number]["key"];

/** Houston wall-clock parts for an instant, without a date library. */
export function houstonParts(ms: number): { date: string; weekday: number; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, weekday, minutes: +p.hour * 60 + +p.minute };
}

const hm = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3);

/** The bell window an instant falls in, or null (weekends included: no school). Holidays aren't known here. */
export function bellWindow(ms: number): BellKey | null {
  const { weekday, minutes } = houstonParts(ms);
  if (weekday < 1 || weekday > 5) return null;
  return BELL_WINDOWS.find((w) => minutes >= hm(w.from) && minutes < hm(w.to))?.key ?? null;
}

// ---- The log: one line per blockage, and what it adds up to ----------------------------------------------------------

/** A blockage seen by the logger (scripts/trainwatch-log.ts), one JSON line each in data/live/trainwatch-log.jsonl. */
export interface Blockage { id: string; street: string; startMs: number; endMs: number | null; source: "trainwatch" | "demo" }
/** A poll the logger made, so a day with no blockages still counts as a day watched. */
export interface PollMark { pollMs: number }

export interface CrossingHistory {
  id: string;
  street: string;
  /** School-day bell windows the logger was running for. */
  windowsWatched: number;
  /** Of those, windows with at least one blockage overlapping them. */
  windowsBlocked: number;
  blockages: number;
  /** Minutes, for blockages that overlap a bell window and have ended. */
  medianMin: number | null;
  maxMin: number | null;
  demo: boolean;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Does [start, end] touch a bell window? Checked minute by minute, so windows spanning a blockage's middle count. */
export function touchesBell(startMs: number, endMs: number): BellKey | null {
  for (let t = startMs; t <= endMs; t += 60_000) {
    const w = bellWindow(t);
    if (w) return w;
  }
  return bellWindow(endMs);
}

/** Roll the log up per crossing. `polls` tells which bell windows were actually watched (date + window). */
export function summarizeLog(blockages: Blockage[], polls: PollMark[], sensors: TwSensor[]): CrossingHistory[] {
  const watched = new Set<string>();
  for (const p of polls) {
    const w = bellWindow(p.pollMs);
    if (w) watched.add(`${houstonParts(p.pollMs).date}:${w}`);
  }
  return sensors.map((s) => {
    const mine = blockages.filter((b) => b.id === s.id);
    const blockedWindows = new Set<string>();
    const mins: number[] = [];
    for (const b of mine) {
      const end = b.endMs ?? b.startMs;
      const w = touchesBell(b.startMs, end);
      if (!w) continue;
      blockedWindows.add(`${houstonParts(b.startMs).date}:${w}`);
      if (b.endMs !== null) mins.push((b.endMs - b.startMs) / 60_000);
    }
    const med = median(mins);
    return {
      id: s.id, street: s.street, windowsWatched: watched.size, windowsBlocked: blockedWindows.size, blockages: mine.length,
      medianMin: med === null ? null : Math.round(med), maxMin: mins.length ? Math.round(Math.max(...mins)) : null,
      demo: mine.some((b) => b.source === "demo"),
    };
  });
}

/**
 * Turn a series of polls into blockages: a crossing goes blocked → clear, one blockage. `prev` holds the open ones
 * between calls. Uses the City's startTime when it gives one, else the poll time.
 */
export function diffPoll(prev: Map<string, Blockage>, now: TwStatus[], pollMs: number, watch: Set<string>): Blockage[] {
  const closed: Blockage[] = [];
  const seen = new Set<string>();
  for (const s of now) {
    if (!watch.has(s.id)) continue;
    seen.add(s.id);
    const open = prev.get(s.id);
    if (s.blocked && !open) prev.set(s.id, { id: s.id, street: s.street, startMs: s.startMs ?? pollMs, endMs: null, source: "trainwatch" });
    if (!s.blocked && open) {
      prev.delete(s.id);
      closed.push({ ...open, endMs: pollMs });
    }
  }
  // A sensor that vanished from the layer ends its blockage rather than leaving it open forever.
  for (const [id, open] of prev) if (!seen.has(id)) { prev.delete(id); closed.push({ ...open, endMs: pollMs }); }
  return closed;
}
