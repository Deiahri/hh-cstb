# Closed-School Walk Check (prototype)

Families type an address and see the walks their child makes now: to the closure shuttle's pickup at the old campus
(through 2027–28), and straight to the new school (for anyone who skips the shuttle, and for everyone once it ends). Each
walk leads with a one-line answer, such as "Crosses train tracks and 1 dangerous road," built from City-listed dangerous roads
and active railroads. The page states the 2028 end date and HISD's Pre-K rule. It gives the family a packet to print, plus
text to paste into HISD's Transportation Support Request Form ("Walk Route Concerns"). The app also has a closed-zone
overview with a card for each shuttle pickup, a ranked list of corridors the City can act on, and a "Before April 15" page
with a draft City school-zone application for each receiving school.

Every number is recomputed from public layers. None is copied from `../Report.md`. See `../VERIFY.md` for where the
recomputed numbers agree with the report and where they don't.

## Run

```bash
npm install
npm run data      # pull HISD + City of Houston ArcGIS layers into public/data (snapshot)
npm run grounds   # pull OpenStreetMap school grounds around the shuttle campuses → campus_grounds.geojson
npm run crossings # pull traffic signals (TranStar) and public rail crossings (FRA) → signals.json, rail_crossings.json
npm run streets   # pull City street class (MTFP) and road centerline around the crossings and schools → street_context.json
npm run compute   # grid-sample the closed zones → zones.json, corridors.json, shuttles.json, zone_requests.json, ../VERIFY.md
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ (HashRouter, relative paths — host anywhere)
npm test          # AI guardrails, request checks, and the AI grounding on each closed zone's sample point
npm run dev:server # the AI API (server/) on :8788; `npm run dev` proxies /api to it (run `npm --prefix server install` once)
```

The snapshot in `public/data` is already there, so `npm run dev` works offline without the fetch steps.

Add `?lang=es` before the `#` (for example `index.html?lang=es#/`) to open in Spanish, for a flyer link or QR code.

## Who it's for (audience research, 2026-09-26)

- **Families in the old zones, on phones.** Across the seven zones, 49% of households speak Spanish at home and 17% have no home
  internet (ACS 2023, zone-weighted, in the site's reaching-families report). So the family screens come in English and Spanish, open on
  a phone with the map folded away, and have a "Text this" button (an `sms:` link, with no backend and no account). A real SMS or
  WhatsApp line is out of scope for the demo.
- **HISD staff read the packet**, so its body stays in English. The family's instructions above it follow the chosen language.
- **City and HISD staff use the Closed zones, Corridors and Before April 15 pages.** Those stay in English and say so in Spanish.
- The copy rules are at the top of `src/lib/i18n.ts`: neither HISD's voice nor a protest's, never "you qualify," plain words.
  The Spanish hasn't been professionally reviewed, and the app says so.
- Questions only people can answer (shuttle stops and times, Pre-K help, who does pickup) are in `../context/Calls-To-Make.md`.

## Where to cross (walk-plan pivot, 2026-09-26)

The site's warning-families report found that telling families "this road is dangerous" mostly repeats what they know
and pushes families with a car into driving. So each crossing now leads with an action:
- **Lookup:** under each walk, one line per road or track. It names the nearest traffic light on that road, or the
  nearest public rail crossing of that railroad, with the distance, direction and extra walking ("Cross at the traffic
  light at Liberty & Altoona, 550 ft northeast. That adds about 500 ft"). Where there's nothing within 250 m it says
  so, gives the nearest one within 1 km, and names who can change it: the receiving school's principal and the City
  for roads, HISD for rail. It offers a school zone only if the street could get one under HPW's rules (street facts
  from `npm run streets`). Crash counts sit folded under each road. The map adds the lights and crossings, and a
  dotted line through them.
- **Walk plan** (`/plan`, "Print a walk plan"): one page, in English or Spanish. It opens with "walk it once with your
  child," then each walk's crossings, a map, and three one-time actions. Plans with five or more crossings print
  smaller so they stay on one page.
- **Corridors:** a "Traffic light or public rail crossing nearby?" column and a "What can change it" column. It's
  sorted so the uncontrolled crossings come first (E Whitney, Westover, Ralston, Brewster, Crane St, the Port Houston
  track). Rail rows are split by closed zone. A checkbox adds the roads the walk to the old campus crosses too (Airline
  Dr, N Main St, SSgt Macario Garcia Dr, MLK Blvd, N Wayside Dr). The brief called those "newly crossed," which they
  aren't; see `../VERIFY.md`.
- **Packet:** a "Nearest traffic light / public rail crossing" column, and the same fact in the copy-paste text.
  Texas's hazardous-route test says "uncontrolled," so it's stated either way, including when a light is close.
- **Not built, on purpose:** a danger map or area rating, the word "safe," anything addressed to children, alerts or
  accounts, and blocked-train times. For blocked trains, the past year of FRA reports has 0 or 1 at 8 of the 9
  crossings the walks use.
- VERIFY's "warning-families:" rows recompute that report's figures with the app's own code. All of them agree.

## Before April 15 and the pickup cards (2026-09-26)

The site's after-the-shuttle report found a handoff gap. HISD owns the pickup buildings and the shuttle; the City owns the
streets, the school zones and the crossing-guard funding. Only a school's principal can apply for a City school zone, by April
15, with "observation or evidence of students walking" on a street that doesn't border the school. The new walks began four months
after the 2026 deadline. By the 2027 deadline they've been walked for eight months, but only by families who skip the shuttle, so a
count then is a floor. Each draft has a line for the school's own count.
- **Before April 15** (`/april-15`): the streets each receiving school's new walkers cross that their walk to the old campus
  didn't, with crashes, the nearest traffic lights, and the City's class for the street. Each street is sorted by HPW's written
  path to a zone: it "borders the school," or it's "a thoroughfare or collector," on a City-owned street, or neither. Then comes
  one draft of HPW's application per receiving school, in the form's order, printable on its own. The principal fills in the
  contact lines, bell times and signature. Streets on neither path (E Whitney, Westover, Ralston, Brewster and Crane St, all
  local streets with no light within 500 m) go in a separate box that points to the form's crosswalk page and to crossing guards.
  S Wayside borders Carrillo but is TxDOT-owned, and the page says so.
- **Pickup cards** (`/zones`, "The seven pickup sites"): the shuttle, the walk to the old campus (computed), the building's
  Aug 13, 2026 surplus vote with no sale date, and three "not public" items with who to ask: stop spot and times (HISD),
  the school zone and its hours (HPW), and a crossing guard (HISD). The facts shared by all seven are stated once above the cards.
- **Not built, on purpose:** a sale alert, a live shuttle tracker, a "get a bus" button and a transit planner.
- VERIFY's last section lists every street's path, and its on-screen-claims table lists the HPW rules and the surplus vote.

## Walk Check design (2026-09-27)

The family screens now follow the Walk Check wireframes (Figma → static prototype): cream and green, Atkinson Hyperlegible
Next, a bottom action bar on phones, a share sheet, and one question or answer per screen. The prototype resolved addresses by
ZIP code and hardcoded its numbers, principals and council meetings; here every screen runs on `analyzeAddress()` and the
precomputed zone files, and the names it had no source for are left out ("the principal of Kennedy ES", not a name).
Its copy was rewritten to the rules in `src/lib/i18n.ts` (no "safe," no "qualify").
- `/` address (geocoder, map pick, sample points) → `/prek` (closed zones only) → `/walk`: the one-line answer, last year vs
  now, the walk as a strip, where to cross, the shuttle walk, who can change it, the 2-mile cliff, and the map.
- `/help` → `/bus` (what the HISD page holds, drag the suggested stop, then `/packet`) and `/schoolzone` (each road on the
  walk against HPW's written paths, then the principal's draft on `/april-15`).
- `/schools` and `/schools/:nbr`: before → now bars per closed zone, shares of **area**, said on screen.
- A Pre-K answer leads with the school zone, since HISD's page gives Pre-K no bus.
- Old `/?lat=…&lng=…` links redirect to `/walk`. Staff pages (Closed zones, Corridors, Before April 15) are linked in the footer
  and keep their layout; they pick up the new palette through the shared tokens. Dark mode is kept.

## Walk Check static build, ported (2026-09-27)

The team's standalone Walk Check build (plain JS, MapLibre, Nominatim, its own `geo.js`) was folded into this app
rather than shipped beside it, so there's one engine (`analyzeAddress`/`planWalk`) and one data pipeline. Ported:
- Home: "how it works" steps, a "For City and HISD staff" section (with days to April 15) and a sources section.
- `/pick`: a full map picker. Tap to drop a pin, drag it, then "Use this spot". It replaces the fold-out map on Home.
- `/sources`: every public layer, what the app uses it for, and its date. The dates line on the walk links to it.
- `/april-15/:nbr`: one receiving school's draft on its own page, to print alone. The family's school-zone screen links here.
- "How this works" steps on the bus and school-zone screens. The zone detail page gets the longest walk and the roads the
  walk to the pickup crosses most.
- **Not ported, on purpose:** `data.js`'s hand-researched principal names, phones and Super Neighborhood meetings (no
  source), the "is it safe?" headline and the "why this walk qualifies" line (copy rules 2 and 4), "ask again every fall"
  (no source), MapLibre and Nominatim (Leaflet and the ArcGIS geocoder already work here), and the scaled paper previews
  (the packet and draft pages are the documents).

## The Walk Check UI is the app (2026-09-27, later)

The team's static build (`ui/`, plain JS) is now the app's look and screens, rebuilt in React on the app's own analysis,
so there's one codebase and one set of numbers. This supersedes the screen lists in the sections above.
- **Screens:** `/` home (address, map picker `/pick`, sample points) → `/walk` (the one-line answer, distance and minutes,
  K–5 / Pre-K toggle, each crossing numbered with "Show on map" and who can change it, the shuttle, after the shuttle; Print
  gives the one-page walk plan) → `/help` → `/bus` (HISD bus-stop request) and `/schoolzone` (City school-zone application),
  each shown as the letter the principal gets, with Print and Share. `/bus` links to `/packet` for families who file HISD's
  online form themselves. `/zones` and `/zone/:nbr` (schools that closed), `/sources`, `/nozone`, `/prek`.
- **Staff (English):** `/data` (closed zones and the seven pickups), `/corridors`, `/april15`, `/draft/:nbr`.
- **Maps:** MapLibre with OpenFreeMap's Positron basemap, as in `ui/`. Leaflet is gone.
- **Kept from before:** the ArcGIS geocoder, the URL carrying the home (`?lat&lng&addr&prek`) so any walk screen can be
  reloaded or shared, and the Spanish "not professionally reviewed" note.
- **Changed from `ui/`, on purpose:** the "Is it safe?" headline, "Why this walk qualifies" and "Califica" lines (copy
  rules 2 and 4), the hand-researched principal names, phones and Super Neighborhood meetings (no source: the screens say "the
  principal of <school>" and "ask at the front office"), "ask again every fall" (no source), and the bus request's "a map of the
  walk" (the letter has no map). Where to cross comes from `planWalk()`, so a road with no light within 1 km says so instead
  of naming a far one.
- **Removed:** the React-only screens (walk strip, pickup cards, `/plan`, the older staff layouts). Old links redirect:
  `/schools` → `/zones`, `/april-15` → `/april15`, `/april-15/:nbr` → `/draft/:nbr`, `/plan` → `/walk`.
- The static build's to-do list is in `docs/improvements.md`.

## AI assistant (2026-09-27)

Built from the research in `docs/ai-assistant/` (ideas 1, 3 and 6, the ones it says to build). Everything else on the site
stays static and works without it; the AI parts appear only when `GET /api/ai` answers that the proxy is on.
- **Ask about this result** (`/walk`, idea 1): a chat box under "After the shuttle ends". It's grounded on the page's own result
  for that home (`src/lib/ai/grounding.ts`): the schools, distances, each crossing and the page's "where to cross" sentence, the
  shuttle, the 2-mile rule, Pre-K. **No address and no coordinates are sent**; the proxy refuses a request that carries any.
- **Describe the walk for HISD** (`/bus`, and `/packet`; idea 3): the family writes what the walk is like in any language; the assistant
  drafts one English sentence for the Description box of HISD's form. Their words and the draft sit side by side, and only a tap
  on "Use this sentence" adds it, as "Walkway conditions (family's description)", to the bus request and to `/packet`'s copy box and page. Nothing is submitted.
- **Ask the data** (`/corridors`, `/april15`) and **Draft the narrative** (`/draft/:nbr`), idea 6, for staff: answers
  from `corridors.json`, `zone_requests.json` and `zones.json`, which the proxy reads from `public/data`. Every number carries
  its row id; ids are chips that scroll to and light the row, and ids that aren't in the data are dropped before the answer arrives.

**The proxy** is its own small Node service in `server/` (`server/index.ts`: CORS, a 64 KB body cap, a rate limit;
`server/ai.ts`: `/api/ai`). The site is a static build that calls it at `VITE_API_URL`. The proxy holds the key, builds the
prompts on the server (`server/lib/prompts.ts`), reads the staff data from `public/data`, and checks every answer in code
(`server/lib/guard.ts`):
the copy rules' words ("safe", "qualifies", "seguro", "califica"…), a reading-level check on family answers, and staff
citations. A failed check gets one retry with a note, then a fixed answer that points to HISD's closure line. It stores
nothing and logs only the mode, the outcome and the retry count. Model: `claude-opus-5` unless `AI_MODEL` says otherwise
(`claude-sonnet-5` and `claude-haiku-4-5` cost less; test them on sample addresses first). Costs are in
`docs/ai-assistant/build-notes.md`.

To run it: `npm --prefix server install`, copy `server/.env.example` to `server/.env`, set `ANTHROPIC_API_KEY` (or
`AI_MOCK=1` for canned demo answers with no key), then `npm run dev:server` and, in another terminal, `npm run dev`.

**Deploying on Render** (`render.yaml`, two services, both on branch `ai-test`):
1. Render → New → Blueprint → this repo. It creates `hh-cstb` (static site: `npm run build`, publishes `dist/`) and
   `hh-cstb-api` (Node web service: `server/`). When asked, enter `ANTHROPIC_API_KEY` (or leave it empty and add `AI_MOCK=1`
   to the API's environment for the demo).
2. Once both exist, set `VITE_API_URL` on the static site to the API's URL (e.g. `https://hh-cstb-api.onrender.com`) and
   `ALLOWED_ORIGINS` on the API to the site's URL (e.g. `https://hh-cstb.onrender.com`). Then redeploy the static site:
   `VITE_API_URL` is baked in at build time.
3. Without `VITE_API_URL`, or with the API off, the site works and the AI panels stay hidden.

The API refuses other websites' pages (`ALLOWED_ORIGINS`) and rate-limits in memory: 20 requests per IP per 10 minutes, and
`AI_MAX_PER_HOUR` (default 300) for everyone, as a ceiling on the bill. Render's free web service sleeps after 15 idle
minutes, so the first AI panel after a quiet spell takes up to a minute to appear; the site itself is unaffected.

The "this is AI" notice shows before the first message (Texas HB 149 §552.051 asks that of a government's AI;
it's shown either way). Spanish answers sit under the page's existing "not professionally reviewed" banner.
- **Not verified yet:** answer quality from the real model. The build was tested end to end with `AI_MOCK=1` and unit tests;
  no API key was available. Try each closed zone's sample point in English and Spanish before a demo.

## Walking routes (2026-09-27, from Murphy Amos's PR #1)

The walk to school (and to the shuttle pickup) is a walking route when the API has an OpenRouteService key: `POST /api/walk`
(`server/walk.ts`) asks ORS's **foot-walking** profile for the home → school route, checks it (Houston area, endpoints within
250 m of the pins, length within 15% of ORS's distance) and caches it for 5 minutes. The page (`src/lib/routing.ts`,
`useWalkingAddress.ts`) checks it again, draws that exact line, and finds the crossings along every segment of it
(`route-hazards.ts`, the same grouping and counts as `hazardsOnRoute`), in the order the walk meets them. Distances shown
are along the route; the 2-mile bus rule stays on the straight line. The screens wait ("Checking…", up to 12 s) so a verdict
never changes after it shows. With no key, an error or a timeout, the walks are straight lines as before and the map key says
so. To turn it on: set `ORS_API_KEY` on `hh-cstb-api` (and in `server/.env` locally). Home coordinates go to our API and
on to ORS; nothing is stored. Method and limits: `docs/walking-routes.md`.

## Live rail sensors and the shuttle simulation (2026-09-27)

**Train Watch, live.** The City's Train Watch map (houstontx.gov/trainwatch) runs on a public ArcGIS layer with no key
(`Train_Watch_Layer/FeatureServer/0`, refreshed about every 30 s). Each sensor's `code` is its FRA crossing id, the
same id as `rail_crossings.json`, so it joins without any geometry matching.
- `npm run trainwatch` pulls the 56 sensors into `trainwatch.json`. It ranks every public rail crossing the closed
  zones' walks are told to use into `sensor_gaps.json` (add `-- --offline` to re-rank without the network).
  As of 2026-09-27, the walks use 56 crossings, 39 of them at street level. **Only one, Cavalcade St, has a sensor.** The
  busiest ones with no sensor: Pleasantville Dr (277 sample points), Cornell (102), Jensen Dr (98), Dorsett St (88).
- **Walk page:** a rail crossing with a sensor within 1 km shows "a train is blocking the crossing right now", or "no train there right now",
  with the City's estimate and "never cross between or under a stopped train." It polls only while such a crossing is
  on screen, pauses in a hidden tab, and never prints. English and Spanish.
- **`/sensors`** (staff, linked from the staff nav): live status, the ranked list of where the next sensors would cover the most walks, and a
  map.
- **`npm run live:log`** records each blockage at the watched crossings (raw log in `data/live/`, gitignored).
  `-- --summarize` writes `public/data/live/history.json`: bell-window counts per crossing for `/sensors`.

**`/sim`, a simulated morning on the closure shuttles** (staff nav). There's one bus per pairing in `shuttles.json`.
- **Telematics:** GPS, speed and doors. Each bus stops at every at-grade crossing (49 CFR 392.10).
- **Routes:** each route uses the nearest public road crossing of each track. Buses drive straight lines between
  crossings, since the walking routes cover people on foot, not buses.
- **SMARTtag re-creation:** riders tap on at the pickup and off at the school, and the driver keys in a tap when a
  badge is missing. **Riders, tags and counts are invented.** Real SMARTtag records are HISD's and are FERPA education
  records, and none are used.
- **Dispatch agent** (`src/lib/sim/agent.ts`, rules in code so a reroute never waits on a model):
  - It looks 1.2 km ahead. If a crossing is blocked (live Train Watch, or the demo's train at Pleasantville Dr), it
    re-plans through another public crossing when that costs less time than the City's estimate, and holds otherwise.
  - It logs unexplained stops.
  - It drafts a parent notice when a bus runs 2+ minutes late, and sends nothing.
  - At the school, it compares taps on with taps off, and the roster with taps on.
  - Every entry gets an id (`[E15]`).
- **Day report:** `/api/ai` mode `dispatch` reads only that log and cites entries. It runs the same word checks and
  retry as the other modes, refuses coordinates, and has an `AI_MOCK=1` reply (`server/ai.ts`, `server/lib/`).
- Tests: `src/lib/sim/sim.test.ts` covers the live parsing, the bell-window math, and a full demo morning (one reroute, a
  stall, a late notice, a missed tap-off, a no-show and a manual tap), plus a morning with no events.

## Layout

- `scripts/fetch-data.ts`: paginated ArcGIS REST pulls. Layer ids are irregular (6, 1, 0, 1, …), and HISD's railroad service is spelled `Texas_Rainroads`.
- `scripts/shuttle-pairs.ts`: HISD's announced closure-shuttle pairings (all 12 campuses), keyed by campus number, with sources and flags.
- `scripts/fetch-grounds.ts`: Overpass pull of OSM school grounds around each shuttle endpoint. It retries and falls back to a mirror, because the main server 504s under load.
- `scripts/fetch-crossings.ts`: TranStar's City, TxDOT and Harris County signal lists (POST `{}`, no key; fire-station signals dropped) and FRA's Form 71 inventory (open public crossings in Harris; port and plant driveways dropped by name). It merges `signals` and `rail_crossings` into meta.json, with the Houston-time date read.
- `scripts/fetch-streets.ts`: for each road the walks to a receiving school cross, the City's Major Thoroughfare and Freeway Plan class and owner at the crossing points, whether it borders the school (City road centerline within 30 m of the OSM grounds), and the From/To cross streets on the centerline just outside where the walks cross. Writes `street_context.json`; merges `mtfp` and `centerline` into meta.json.
- `scripts/grid.ts`: the ~110 m sample grid, point for point the one `compute.ts` walks, for `fetch-streets.ts`.
- `scripts/compute.ts`: diffs the zones, samples a ~110 m grid, computes the hazard shares, the corridor ranking and each corridor's crossing control, the per-receiving-school street requests (`zone_requests.json`), and writes the VERIFY report.
- `src/lib/geo.ts`: point-in-polygon, haversine, segment intersection. Shared by the scripts and the browser.
- `src/lib/analyze.ts`: `analyzeAddress()`, the single analysis the precompute and the UI both run.
- `src/lib/crossings.ts`: which signals and rail crossings belong to a crossed road or track, `planWalk()` (the nearest control, direction and detour per crossing), and `zonePossible()`. Ported from `research/warning-families/crossing-options.mts`.
- `src/lib/walk.ts`: `useWalk()`/`analyzeWalk()`, the address in the URL analysed once for every screen, and `zoneStreets()`.
- `src/lib/ui/`: the screens' strings in English and Spanish (`strings.ts`, ported from `ui/app.js`), the result shape the
  screens draw from (`model.ts`: `toUiResult`, `closedZones`, where-to-cross wording), `useUiWalk()`, and the sourced contacts.
- `src/components/ui/`: the map (`WcMap.tsx`), the letters (`docs.tsx`: walk plan, bus request, school-zone application), the
  share sheet, and the small pieces (action bar, paper preview, print root, who card, bars).
- `src/pages/`: Home (home, map picker, Pre-K, not a closed zone), Walk, Requests (help, bus, school zone), Packet, Zones
  (schools that closed, one zone, sources), Staff (data, corridors, Before April 15, one school's draft).
- `src/ui.css`: `ui/styles.css`, plus the AI panels. `src/lib/i18n.ts`: the language switch, the copy rules, and the packet
  and AI strings.
- `server/`: the API, a separate Node service (own `package.json`). `index.ts`: HTTP, CORS, rate limit; `ai.ts`, `lib/`:
  the AI proxy, its prompts, checks and demo replies; `walk.ts`: the walking-route proxy. `render.yaml`: the two Render services. `src/lib/ai/`: the request
  types, the page's grounding for one home, the walkway sentence, and the client. `src/components/AiPanel.tsx`,
  `AskResult.tsx`, `WalkwayHelper.tsx`, `StaffAsk.tsx`: the AI boxes.

## Limits (also shown in the UI)

- Without `ORS_API_KEY` routes are straight lines, so every result is a floor. A street route crosses at least as many
  hazards. With it, routes follow OpenStreetMap's mapped walkways, which nobody has checked on foot. Zone-wide shares (Zones,
  Staff) are always straight lines.
- Shares are of zone **area**, not students or homes. Next step: weight by HCAD residential parcels.
- The tool produces evidence, not an eligibility decision. §48.151 also needs "no walkway", and Houston publishes no sidewalk data.
- Crash data is the City's HIN 2022, the newest the City publishes. The railroad layer was last edited 2024-02-15.
- **Shuttle stops are campus-level.** HISD says the shuttle runs "from their current campus to their receiving school site" and
  has published no stop spot, times, runs or streets. The map shows the pickup campus's grounds (OSM outline), not a curb, and a
  straight connector, not a route. Ross's announced drop-offs (Roosevelt, C. Martinez) differ from the boundary layer (Dogan, Roosevelt).
- The address search uses the keyless ArcGIS World Geocoder. Clicking the map always works as a fallback.
- **Where to cross covers traffic signals and public rail crossings only.** Crossing guards, stop signs and marked
  crosswalks aren't in any public Houston layer, so a guarded crossing shows as "no traffic light." The detour is
  home → light → school in straight lines, not a street route. A light is "controlled," not a promise, and the page
  never says "safe." The signal feed is TranStar's public map, with no date and no stated license, so ask the City
  before relying on it.
- **The April 15 street facts are a sort, not a ruling.** HPW decides after its own traffic study. "Not on the plan" means no
  MTFP line within 40 m at most crossing points. From/To are the centerline cross streets just outside the outermost crossing, and
  HPW sets the final limits. Two ends found no cross street and print "HPW sets." Kennedy ES has no OSM grounds, so its "borders
  the school" check uses the campus point (marked approx.). Whether each old campus's school zone is still in the ordinance isn't public.
