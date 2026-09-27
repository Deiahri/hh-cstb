# Closed-School Walk Check (prototype)

Families type an address and see the walks their child makes now: to the closure shuttle's pickup at the old campus
(through 2027–28), and directly to the new school (for anyone who skips the shuttle, and for everyone once it ends). Each
walk leads with a one-line answer, about potential map intersections, built from City-listed dangerous roads
and active railroads. The page states the 2028 end date and HISD's Pre-K rule. It gives the family a packet to print, plus
text to paste into HISD's Transportation Support Request Form ("Walk Route Concerns"). The app also has a closed-zone
overview with a card for each shuttle pickup, a ranked list of corridors the City can act on, and a "Before April 15" page
with a draft City school-zone application for each receiving school.

Every number is recomputed from public layers. None is copied from `../Report.md`. See `../VERIFY.md` for where the
recomputed numbers agree with the report and where they don't.

## Run

```bash
npm ci
npm run data      # pull HISD + City of Houston ArcGIS layers into public/data (snapshot)
npm run grounds   # pull OpenStreetMap school grounds around the shuttle campuses → campus_grounds.geojson
npm run crossings # pull traffic signals (TranStar) and public rail crossings (FRA) → signals.json, rail_crossings.json
npm run streets   # pull City street class (MTFP) and road centerline around the crossings and schools → street_context.json
npm run compute   # grid-sample the closed zones → zones.json, corridors.json, shuttles.json, zone_requests.json, ../VERIFY.md
npm run dev       # http://localhost:5173; /api proxies to the local Node server
npm run build     # TypeScript check + frontend in dist/
npm test          # focused routing tests; run after build
npm start         # serve dist/ and /api/walk on port 3000 (or PORT)
```

The snapshot in `public/data` is already included. Do not run the fetch/compute steps for normal local testing.
Live routing needs a server-only `ORS_API_KEY`. Copy `.env.example` to `.env`, add your key, then run
`node --env-file=.env server/index.mjs` alongside `npm run dev`. For a production check, run the build
and that same server command, then open http://localhost:3000. Without a key, pages display labeled
straight-line estimates. A Vite preview or static-only host does not provide the routing API.

See [walking-routes.md](docs/walking-routes.md) for Render settings, the exact Holly Hall test link,
current data dates, the routing method, verification and remaining deployment prerequisites.

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
- **Walk Check** (`/walk`): the displayed pedestrian geometry drives the potential hazard list. Each
  listed road or railroad includes nearby controls as context, with no unverified detour line or
  instruction to leave the route. The map preserves home/school pins and labels network endpoint gaps.
  If routing is unavailable, distances and hazards are explicitly identified as straight-line estimates.
- **Walk plan** (`/plan`, "Print a walk plan"): one page, in English or Spanish. It opens with a request to check entrances and crossings locally, then each walk's potential intersections, a map, and three one-time actions. Plans with five or more crossings print
  smaller so they stay on one page.
- **Corridors:** a "Traffic light or public rail crossing nearby?" column and a "What can change it" column. It's
  sorted so the uncontrolled crossings come first (E Whitney, Westover, Ralston, Brewster, Crane St, the Port Houston
  track). Rail rows are split by closed zone. A checkbox adds the roads the walk to the old campus crosses too (Airline
  Dr, N Main St, SSgt Macario Garcia Dr, MLK Blvd, N Wayside Dr). The brief called those "newly crossed," which they
  aren't; see `../VERIFY.md`.
- **Packet:** a "Nearest traffic light / public rail crossing" column, and the same fact in the copy-paste text.
  A nearby light is not proof that a crossing is accessible, controlled at grade, or suitable for a child.
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
ZIP code and hardcoded its numbers, principals and council meetings; here address screens use `useWalk()` (school assignment plus live pedestrian routing) and staff
views retain the precomputed zone files, and the names it had no source for are left out ("the principal of Kennedy ES", not a name).
Its copy was rewritten to the rules in `src/lib/i18n.ts` (no "safe," no "qualify").
- `/` address (geocoder, map pick, sample points) → `/prek` (closed zones only) → `/walk`: the one-line answer, last year vs
  now, potential intersections as a schematic strip, nearby controls to check, the shuttle walk, who can change it, the 2-mile cliff, and the map.
- `/help` → `/bus` (what the HISD page holds, drag the suggested stop, then `/packet`) and `/schoolzone` (each road on the
  walk against HPW's written paths, then the principal's draft on `/april-15`).
- `/schools` and `/schools/:nbr`: before → now bars per closed zone, shares of **area**, said on screen.
- A Pre-K answer leads with the school zone, since HISD's page gives Pre-K no bus.
- Old `/?lat=…&lng=…` links redirect to `/walk`. Staff pages (Closed zones, Corridors, Before April 15) are linked in the footer
  and keep their layout; they pick up the new palette through the shared tokens. Dark mode is kept.

## Layout

- `scripts/fetch-data.ts`: paginated ArcGIS REST pulls. Layer ids are irregular (6, 1, 0, 1, …), and HISD's railroad service is spelled `Texas_Rainroads`.
- `scripts/shuttle-pairs.ts`: HISD's announced closure-shuttle pairings (all 12 campuses), keyed by campus number, with sources and flags.
- `scripts/fetch-grounds.ts`: Overpass pull of OSM school grounds around each shuttle endpoint. It retries and falls back to a mirror, because the main server 504s under load.
- `scripts/fetch-crossings.ts`: TranStar's City, TxDOT and Harris County signal lists (POST `{}`, no key; fire-station signals dropped) and FRA's Form 71 inventory (open public crossings in Harris; port and plant driveways dropped by name). It merges `signals` and `rail_crossings` into meta.json, with the Houston-time date read.
- `scripts/fetch-streets.ts`: for each road the walks to a receiving school cross, the City's Major Thoroughfare and Freeway Plan class and owner at the crossing points, whether it borders the school (City road centerline within 30 m of the OSM grounds), and the From/To cross streets on the centerline just outside where the walks cross. Writes `street_context.json`; merges `mtfp` and `centerline` into meta.json.
- `scripts/grid.ts`: the ~110 m sample grid, point for point the one `compute.ts` walks, for `fetch-streets.ts`.
- `scripts/compute.ts`: diffs the zones, samples a ~110 m grid, computes the hazard shares, the corridor ranking and each corridor's crossing control, the per-receiving-school street requests (`zone_requests.json`), and writes the VERIFY report.
- `src/lib/geo.ts`: point-in-polygon, haversine, segment intersection. Shared by the scripts and the browser.
- `src/lib/analyze.ts`: original school assignment and straight-line analysis, preserved for precompute and fallback.
- `src/lib/crossings.ts`: which signals and rail crossings belong to a crossed road or track, `planWalk()` (the nearest control, direction and detour per crossing), and `zonePossible()`. Ported from `research/warning-families/crossing-options.mts`.
- `src/lib/walk.ts`: `useWalk()`, shared by Walk, Ask, Plan and Packet, and `zoneStreets()`.
- `src/lib/useWalkingAddress.ts`, `routing.ts`, `route-hazards.ts`: route loading/cache, validated geometry and path-based hazards.
- `src/components/RouteLayers.tsx` and `RouteStatus.tsx`: shared geometry, bounds inputs, distance and fallback disclosures.
- `server/index.mjs`: production frontend server and same-origin pedestrian API; `render.yaml` documents a Node Web Service.
- `src/components/WalkCheck.tsx` and `src/walkcheck.css`: the logo, splash, walk strip, bars and share sheet.
- `src/components/CrossingPlan.tsx`: the where-to-cross list and the once-per-page "who can change this".
- `src/components/ShuttleLayer.tsx`: the shuttle layer on the Closed zones map and the address check.
- `src/lib/i18n.ts`: every family-facing sentence in English and Spanish, the copy rules, and display-time translation of the shuttle flags.
- `src/pages/`: Home, Walk (Pre-K question, answer, not-a-closed-zone), Ask (help, bus, school zone), Schools, Plan (the family's walk plan, print), Packet (HISD, print), Overview (`/zones`), Corridors, April15 (`/april-15`).
- `src/components/PickupCards.tsx` and `src/lib/pickups.ts`: the seven pickup cards and their fixed facts. `src/april15.css` styles both, apart from `styles.css`.

## Limits (also shown in the UI)

- Address pages use pedestrian routes when available; fallbacks and precomputed research use straight lines. Their hazard sets can differ. Neither method proves a safe path or a minimum crossing count.
- Shares are of zone **area**, not students or homes. Next step: weight by HCAD residential parcels.
- The tool produces evidence, not an eligibility decision. §48.151 also needs "no walkway", and Houston publishes no sidewalk data.
- Crash data is the City's HIN 2022, the newest the City publishes. The railroad layer was last edited 2024-02-15.
- **Shuttle stops are campus-level.** HISD says the shuttle runs "from their current campus to their receiving school site" and
  has published no stop spot, times, runs or streets. The map shows the pickup campus's grounds (OSM outline), not a curb, and a
  straight connector, not a route. Ross's announced drop-offs (Roosevelt, C. Martinez) differ from the boundary layer (Dogan, Roosevelt).
- The address search uses the keyless ArcGIS World Geocoder. Clicking the map always works as a fallback.
- **Where to cross covers traffic signals and public rail crossings only.** Crossing guards, stop signs and marked
  crosswalks are not included in the current datasets. Nearby controls are context only; the app does not route a detour to them or establish an at-grade crossing. The signal feed is TranStar's public map, with no date and no stated license, so ask the City
  before relying on it.
- **The April 15 street facts are a sort, not a ruling.** HPW decides after its own traffic study. "Not on the plan" means no
  MTFP line within 40 m at most crossing points. From/To are the centerline cross streets just outside the outermost crossing, and
  HPW sets the final limits. Two ends found no cross street and print "HPW sets." Kennedy ES has no OSM grounds, so its "borders
  the school" check uses the campus point (marked approx.). Whether each old campus's school zone is still in the ordinance isn't public.
