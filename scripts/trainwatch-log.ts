// Logs Train Watch blockages at the crossings the closed zones' walks and shuttles use, so "blocked at bell time" can
// be counted instead of guessed. Run it where it can stay up (a laptop, a small VM, a cron'd container):
//
//   npm run live:log                   # poll every 30 s, forever; one JSON line per blockage in data/live/
//   npm run live:log -- --summarize    # roll the log up into public/data/live/history.json for /sensors
//
// It watches the sensors sensor_gaps.json ties to the walks (npm run trainwatch first). The log is raw facts from a
// public City feed: crossing, start, end. Nothing about any person.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BELL_WINDOWS, type Blockage, POLL_MS, type PollMark, type TwSensor, diffPoll, fetchTrainWatch, summarizeLog } from "../src/lib/live";

const root = join(import.meta.dirname, "..");
const dataDir = join(root, "public", "data");
const logDir = join(root, "data", "live");
const LOG = join(logDir, "trainwatch-log.jsonl");
const POLLS = join(logDir, "polls.jsonl");
mkdirSync(logDir, { recursive: true });

const gaps = JSON.parse(readFileSync(join(dataDir, "sensor_gaps.json"), "utf8"));
const snap = JSON.parse(readFileSync(join(dataDir, "trainwatch.json"), "utf8"));
const ids = new Set<string>([
  ...gaps.crossings.filter((c: { monitored: boolean }) => c.monitored).map((c: { id: string }) => c.id),
  ...gaps.nearbySensors.map((s: { id: string }) => s.id),
]);
const watched: TwSensor[] = snap.sensors.filter((s: TwSensor) => ids.has(s.id));

const readLines = <T,>(f: string): T[] => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : []);

if (process.argv.includes("--summarize")) {
  const blockages = readLines<Blockage>(LOG);
  const polls = readLines<PollMark>(POLLS);
  const times = polls.map((p) => p.pollMs);
  const out = {
    generatedAt: new Date().toISOString(),
    from: times.length ? new Date(Math.min(...times)).toISOString() : null,
    to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    demo: blockages.some((b) => b.source === "demo"),
    windows: BELL_WINDOWS.map((w) => ({ ...w })),
    crossings: summarizeLog(blockages, polls, watched),
  };
  mkdirSync(join(dataDir, "live"), { recursive: true });
  writeFileSync(join(dataDir, "live", "history.json"), JSON.stringify(out, null, 1));
  console.log(`${blockages.length} blockages over ${polls.length} polls → public/data/live/history.json`);
  process.exit(0);
}

console.log(`Watching ${watched.map((s) => s.street).join(", ")} every ${POLL_MS / 1000} s. Ctrl-C to stop.`);
const open = new Map<string, Blockage>();
let lastMark = 0;
async function poll() {
  const t = Date.now();
  try {
    const { statuses } = await fetchTrainWatch();
    for (const b of diffPoll(open, statuses, t, ids)) {
      appendFileSync(LOG, `${JSON.stringify(b)}\n`);
      console.log(`${new Date(b.startMs).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} ${b.street}: blocked ${Math.round(((b.endMs ?? t) - b.startMs) / 60000)} min`);
    }
    // One poll mark a minute is enough to know which bell windows were watched.
    if (t - lastMark >= 60_000) { appendFileSync(POLLS, `${JSON.stringify({ pollMs: t })}\n`); lastMark = t; }
  } catch (e) {
    console.error(`poll failed: ${(e as Error).message}`);
  }
}
await poll();
setInterval(poll, POLL_MS);
