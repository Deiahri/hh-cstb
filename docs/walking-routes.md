# Walking routes: method, deployment and checks

## Current project and preserved data

Adapted on 2026-09-27 to `master` **814a6852b4c3dad6f981b3d4cbccb13cc1366197**
("Integrate the Walk Check UI on the real data"). The earlier patch against `6c31c39` was treated as
unapplied. The new Home/Pre-K/Walk/Ask/Schools screens, styling and shared components are retained;
`Lookup.tsx` is not restored. Legacy `#/?lat=…&lng=…` links still redirect to `/walk`.
The live app's JavaScript asset matched the unmodified baseline production build by SHA-256 during
inspection. That confirms the deployed baseline bundle, not a deployment of this patch.

No source datasets were fetched or regenerated for this change. All current `public/data` files
are unchanged. Dates below are from the repository's `public/data/meta.json`, not new retrievals:

| Dataset | Existing snapshot/read date | Source edit date / vintage |
| --- | --- | --- |
| HISD campuses, boundaries and active rail | 2026-09-23 UTC | 2026–27 campuses: 2026-09-01; boundaries: 2026-07-08; rail: 2024-02-15 |
| City pedestrian-dangerous roads / HIN | 2026-09-23 UTC | HIN 2022; layer edits 2025-08-11 / 2025-08-08 |
| OpenStreetMap campus grounds | 2026-09-26 UTC | 2025-11-08 (recorded latest edit) |
| TranStar traffic signals | 2026-09-27 UTC / read 2026-09-26 Houston time | Feed provides no edit date |
| FRA rail-crossing inventory | 2026-09-27 UTC / read 2026-09-26 Houston time | 2026-09-26 |
| City MTFP / road centerline | 2026-09-27 UTC | 2025-08-07 / 2026-09-25 |

Source URLs and feature counts remain in `meta.json`. Precomputed zones, corridors, shuttles and
school-zone request files keep their original computation dates and straight-line methodology.
Live pedestrian geometry is fetched separately from openrouteservice/OpenStreetMap on demand;
this package does not contain newly retrieved pedestrian routes.

## Why the old line cut across streets

`src/components/RouteLayers.tsx` had only two coordinates: home and campus. `analyzeAddress` checked that straight
segment. `planWalk` joined traffic-control points with additional straight segments. The street-data
script supplies classifications and school-zone context, not a connected pedestrian routing graph.

## What changes and why it is consistent

1. School assignment still comes from the same HISD polygons and campus points.
2. `useWalk` delegates to `useWalkingAddress`, which requests each distinct home/campus pair via same-origin `POST /api/walk`.
3. The Node server calls openrouteservice's **foot-walking** GeoJSON endpoint. The API key stays on the
   server. The browser validates coordinates, length, distance and endpoint proximity before use.
4. The identical returned coordinate array is drawn by Leaflet and passed to `hazardsOnPath`.
   Every route segment is checked, including intersections at route vertices. Source features are
   counted once; overlapping HIN/ped-HIN totals use the larger layer sum, as in the original method.
5. Results retain the existing grouping (distinct road name or railroad company) and display the
   **first encounter along the path**, not the nearest encounter to the home. Repeated crossings of
   the same road/company are not separate list entries. All intersected feature IDs are retained.
6. The original `distance` remains straight-line metres. Routed distance lives separately in
   `routing.route.distanceM`. Offline scripts, stored datasets, area statistics and existing
   distance-rule calculations are unchanged. Differences between old/new hazard sets are shown
   only when both walking routes succeeded, so different methods are not compared.
7. Walk Check (the replacement for Lookup), Help/Bus/SchoolZone, Plan and Packet use the same
   `useWalk` hook, cache, geometry and hazard analysis. Changing an
   address immediately hides old results; cancellation and a request key prevent stale updates.

Nearby controls are **context only**. Signal coordinates do not prove an accessible pedestrian
waypoint. The earlier cyan straight-line detours and unsupported "cross here"/extra-distance
instructions are removed from address pages. This version does not offer a routed alternative via
those controls. Implementing that later requires valid pedestrian access points, a fresh route and
fresh hazard analysis. No suggested path is drawn that bypasses the pedestrian router.

The original pins remain in place. Circles identify snapped network endpoints; per-route text gives
the gap to each pin. No straight connector is presented as walkable access, and gaps are excluded
from routed distance. The server asks for a maximum 200 m snap radius; the client rejects endpoint
gaps above 250 m. It rejects malformed or implausible geometry rather than disguising it as success.

## Render deployment prerequisite

The repository previously supplied a static Vite build and no server or Render configuration. A
Render URL alone does not establish its service type; this change does not access or alter the
existing Render dashboard. No live deployment has been performed.

Use a **Node Web Service**, not a Static Site:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Node: 24 (the existing Vite toolchain requires a modern Node version)
- Secret environment variable: `ORS_API_KEY`, obtained from the operator's openrouteservice account
- Optional: `ROUTING_REQUESTS_PER_MINUTE` (default 30 upstream requests per minute, global per instance)
- Health check: `/healthz`; it returns `routingConfigured` without exposing the key. This reports
  configuration presence, not provider validity or quota availability.

`render.yaml` is an optional blueprint for these settings. It does not convert or retarget an existing
Static Site. If the current site is static, create/configure the web service and verify its URL before
switching traffic. Simply merging this PR into a static deployment will **not enable live routing**.
Do not create a browser `VITE_ORS_API_KEY`. No paid service or account has been provisioned by this PR.

For local development, copy `.env.example` to `.env` and supply the key locally. In one terminal run
`node --env-file=.env server/index.mjs`; in another run `npm run dev`. Vite proxies `/api` to port 3000.
For a production check run `npm run build` and `node --env-file=.env server/index.mjs`; open port 3000.
`npm start` reads environment variables injected by Render; it does not load `.env` automatically.

The server serves `dist/` and `/api/walk` on the same origin and supports Render's `PORT`. API requests
accept only two numeric coordinates in the Houston region, have a small body limit, and cannot choose
an upstream URL or profile. Upstream calls have a 10-second timeout and a bounded 5-minute memory cache.
The browser times out after 14 seconds and also keeps only a bounded 5-minute memory cache. Errors are
not cached. HTTP responses use `no-store`; exact coordinates are not persisted or logged by our code.
Coordinates are sent to openrouteservice to calculate the route. Provider/hosting retention policies
still apply. Rate limiting is per instance; multiple instances need a shared quota strategy.

## Limits and fallback

Routing requires available credentials, provider quota, network access and mapped pedestrian paths.
Missing configuration, request failures, timeouts or invalid routes produce an explicit straight-line
fallback. The page stays usable, but this is not evidence that walking routing succeeded.

Intersections are **potential 2D intersections**, not certified crossings or a safety guarantee. A
bridge/tunnel may intersect a line on the map. Parallel travel along a hazardous corridor and
collinear overlaps are not counted as transverse intersections. Road centerlines and pedestrian map
geometry can disagree. Sidewalk completeness, entrances, private access, temporary closures and
actual shuttle stop locations need local verification. A route can encounter different hazards from
the straight line. This feature does not make an eligibility determination.

## Verification

Run `npm ci`, `npm run build`, then `npm test` (the HTTP test serves the production `dist/`). The focused
suite covers coordinate order, invalid geometry, snap gaps, distance/geometry agreement, cache expiry,
failed/aborted requests, timeout, hazard bends and vertex intersections, deduplication, route order,
snapshot immutability, production static serving, server-only credentials, pedestrian profile,
request validation, rate limiting, and upstream failures. Address fixtures include the supplied Holly
Hall location and a second Houston point; their route geometries are synthetic, not live directions.

An optional `tests/browser-smoke.mjs` exercises the **built** UI across Walk Check/Plan/Packet and
the follow-up screens, Spanish,
missing-key fallback, cached page navigation and a stale-response race. Run it with an available
Playwright installation and Chromium:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser-smoke.mjs
```

Before enabling live traffic, with a real key verify the Holly Hall address and another address in
all three pages. Confirm the route follows mapped streets/paths, route distances/hazards agree,
network endpoints are labeled, and simulated provider failure displays the fallback. Review a
printed Plan/Packet. Synthetic fixtures cannot certify provider coverage, local access or routing
quality. See the PR validation record for checks actually executed and any blocked checks.

## Local test links and checks actually performed

With Node 24 installed, run `npm ci`, `npm run build`, `npm test`, then start the server as above.
Open this exact address link on the production server:

<http://localhost:3000/#/walk?lat=29.684561&lng=-95.397052&addr=2250+Holly+Hall+St%2C+Houston%2C+TX+77054&all=1>

The address is **2250 Holly Hall St, Houston, TX 77054**, with API coordinates
`[-95.397052, 29.684561]` (longitude first). The existing dataset assigns it to **Whidby ES** in both
years; it is outside the seven closed zones. `all=1` opens its walking details directly instead of
the updated app's "not a closed zone" screen. The ordinary address-search flow is preserved.
A second tested Houston point is longitude `-95.3`, latitude `29.77`.

Checks run for this adaptation:

- `npm ci` and `npm run build` passed. The existing large-bundle warning remains (baseline 561 kB;
  updated build about 571 kB); it is not a failed build. No app dependencies were added.
- `npm test` passed (11 tests). The suite includes actual local datasets for both test locations and synthetic
  route geometry for path analysis, plus production-server HTTP tests.
- `tests/browser-smoke.mjs` passed using a separately installed Playwright 1.51.1/Chromium 134.
  It served `dist/` from the Node server and checked the exact address label, legacy redirect,
  geometry-derived hazard names and distances across Walk/Plan/Packet, follow-up screens, shared
  cache, Spanish, a delayed stale response, invalid geometry, and the actual server's missing-key
  failure. External map tiles and geocoding were blocked in this controlled test.
- Desktop/mobile and print-media screenshots for the Holly Hall fixture were inspected; live tiles
  were intentionally absent. Printed pagination and live-map output still need review before rollout.
- Diff review confirmed no changes to `public/data`, scripts, lockfile or research statistics.

**Not verified:** live ORS directions, actual pedestrian access, real endpoint snapping, the hosted
Render service type/settings, and provider quotas. No usable ORS key or Render dashboard access
was available. The baseline repository contains no GitHub Actions workflow. Local checks do not
establish hosted CI results; publication status is recorded in the accompanying handoff. This is
verified code, not a configured or deployed routing service.

## Rollback

Revert this feature commit and rebuild. No dataset migration or regeneration is required. If the
Node service remains in use after reverting, restore the previous hosting/start configuration too;
the prior commit does not contain `server/index.mjs`.

## Primary references

- [ORS directions and GeoJSON response schema](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types)
- [ORS public API and key setup](https://api.openrouteservice.org/)
- [ORS routing profiles](https://giscience.github.io/openrouteservice-r/reference/ors_profile.html)
- [Render Node web-service deployment](https://render.com/docs/deploy-node-express-app)

## Latest repository recheck

Rechecked during the September 27 afternoon update (America/Chicago). Git fetch and the connected
GitHub API independently returned `814a6852b4c3dad6f981b3d4cbccb13cc1366197` as the latest default
branch (`master`) commit. There were no newer committed source, dataset or deployment changes to
adapt. The earlier patch remains unapplied on master. The live app still returned HTTP 200 with
`assets/index-d9HC2W4p.js`, SHA-256
`efeab7900f6978206dc2e41573a375268890a7e057e9e4cd3e4ac784e7fb2965`.
This is the same baseline bundle inspected previously, not the walking-route implementation.

The production build, all 11 focused tests and the production-browser integration suite were rerun
and passed. No duplicate routing implementation or unrelated code change was needed. The refreshed
package retains the full implementation against this exact base and all 16 unchanged data files.
GitHub reports repository push permission, but the integration rejected the attempted Git tree write
with HTTP 403, "Resource not accessible by integration." No remote branch or PR was created. This
permission metadata does not establish integration write access, deployment access or a configured
ORS key. Publish from an authenticated local clone as described in the handoff.
