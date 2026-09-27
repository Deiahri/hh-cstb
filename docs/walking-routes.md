# Walking routes

Ported on 2026-09-27 from Murphy Amos's PR #1 (`fix/walking-routes-current`, against `master`) onto the ai-test UI. The
routing, validation and hazard logic are his; the hosting and screens follow ai-test (static site + separate API, MapLibre).

## What changes

Before: each walk was two points, home and school, and the hazards were the roads and tracks that straight segment crossed.
Now, when the API has a key:

1. `useWalk` (`src/lib/walk.ts`) runs `useWalkingAddress`, which asks `POST /api/walk` for each distinct home → school pair
   (this year's school, and last year's, which is also the shuttle pickup).
2. The API (`server/walk.ts`) calls OpenRouteService's **foot-walking** GeoJSON directions with a 200 m snap radius. The key
   stays on the server. It accepts only two points in the Houston area, and rejects routes whose ends are more than 250 m from
   the pins or whose line length disagrees with ORS's distance by more than 15%.
3. The browser (`src/lib/routing.ts`) checks the same things again, then draws that exact line (`WcMap.tsx`) and passes it
   to `hazardsOnPath` (`src/lib/route-hazards.ts`). Every segment is checked, route vertices included. Roads group by name and
   railroads by company, as in `hazardsOnRoute`; each City segment counts once; the ped and HIN layers take the larger sum.
   Crossings are listed in the order the walk meets them.
4. Distances on screen are along the route. The straight-line `distance` is unchanged and still drives the 2-mile bus rule
   text, the AI's `twoMileRule`, and every precomputed zone statistic.
5. The gaps between the pins and the route's snapped ends are drawn thin and dashed. They aren't counted as walked.
6. When a route exists, `planWalk` no longer builds its straight home → light → school "path" or detour: a light's point
   isn't known to be on a sidewalk. The nearest light per crossing is still shown, as context.

## Waiting and falling back

The screens that show a walk (`/check`, `/walk`, `/help`, `/bus`, `/schoolzone`, `/packet`) show "Checking…" until every
route has come back or failed, so a verdict never changes after it's on screen. The client gives up after 12 s, the API's
call to ORS after 8 s. A missing key (503), an error, a bad route or a timeout leaves that walk a straight line, labelled
"Walk (straight line)" in the map key, with the straight-line footnotes. Routes are cached in memory for 5 minutes and
failures for 1 minute, so moving between screens doesn't wait again. Nothing goes to browser storage.

## Deploying

On Render, set on `hh-cstb-api` (see `render.yaml`):

- `ORS_API_KEY`: from an openrouteservice.org account. Its free plan caps directions per day and per minute; check the
  current quota against expected traffic.
- `ROUTING_REQUESTS_PER_MINUTE` (default 30): calls to ORS per minute across everyone, per instance. Cache hits don't count.

The site needs `VITE_API_URL` pointing at the API (already required for the AI panels) and the API needs the site in
`ALLOWED_ORIGINS`. Locally: put `ORS_API_KEY` in `server/.env`, run `npm run dev:server` and `npm run dev`.

## Limits

- Crossings are 2D intersections on the map, not confirmed at-grade crossings. A bridge or tunnel over a road still counts.
  Walking alongside a road without crossing it doesn't.
- ORS routes on OpenStreetMap. Missing sidewalks, closed gates and private paths aren't known. Nobody has walked these routes.
- Home coordinates go to our API and to openrouteservice (HeiGIT) to compute the route. Our code logs and stores none of it.
- **Not verified live:** no ORS key was available when this was built. Tests use synthetic routes. Before relying on it, set
  the key and check several addresses' routes against the map, including one where the API is made to fail.
