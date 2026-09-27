# Walk Check: what can still be improved

> Written for the static build in `ui/` (plain JS, MapLibre, Nominatim, `geo.js`), which has since been folded into the
> React app. Items that name those files now apply to their React counterparts (`src/lib/analyze.ts`, `src/lib/i18n.ts`,
> Leaflet, the ArcGIS geocoder). The principal and council contacts it mentions were never ported (no source).

Written 2026-09-27 after the rebuild on real data. Ordered by how much each one would matter to a
family using the site, then to the team demoing it.

## Data and correctness

1. **Straight lines, not streets.** Every crossing is where a straight home-to-school line meets a
   road or track. A real route may cross more, or cross the same road somewhere else. A routing
   engine (OSRM or Valhalla, walking profile) would give the actual sidewalk path and the true
   crossing points. This is the single biggest accuracy gain.
2. **Traffic lights only.** Crossing guards, stop signs and painted crosswalks are not in any public
   layer, so a corner with a guard still says "no traffic light". HISD reports its guard posts to the
   City; a records request or a Super Neighborhood contact could fill this in per school.
3. **Crash counts are 2022.** The City's Vision Zero layers have not been refreshed. Newer Houston
   Police crash data exists but needs geocoding and cleaning.
4. **Principal names.** Four of the eight receiving schools show "The principal of X". Confirm names
   and phone numbers before the documents go to a school. Roosevelt ES has no phone at all.
5. **Shuttle stop and times** are not published by HISD. Once families report them, store them per
   pickup so the walk page can say where on campus to wait.
6. **Ross zone splits** between Dogan and Roosevelt. The receiving school is picked by the 2026–27
   boundary polygon, which is right, but the zone overview only shows one hazard bar for both.
7. **Geocoding.** Nominatim is bounded to greater Houston but still guesses on partial addresses.
   The walk page now echoes the matched address with a "Not right? Fix it" link (done 2026-09-27);
   a confidence check that offers the map picker on weak matches is still open.

## Documents

8. **HPW's actual form.** The school zone draft follows the order of HPW's application but is not
   the PDF itself. Filling HPW's PDF fields directly would let the principal sign without retyping.
9. **HISD's hazardous-route request** has no public form; the draft cites Tex. Educ. Code §48.151.
   Confirm with HISD Transportation what they want attached (a map, a list of families, both).
10. **Family lines on the bus request** are blank rules. A shared sign-up (one link per street) would
    collect neighbors before the principal files.
11. **Spanish documents.** The screen is bilingual; the printed documents are English only, which is
    right for the recipient. A Spanish cover note for the family would help them explain what it is.

## Product

12. **Return visits.** Nothing is saved beyond the tab. A shareable link works, but a family that
    checked once has no way to see "what happened next" (was the request filed, did the zone pass).
13. **Principal view.** A principal with many families needs one page per school: every request
    that mentions their campus, grouped by street. Today each family prints their own.
14. **Feedback loop.** No way to report "there is a guard here" or "the shuttle stops at the side
    gate". A one-tap report per crossing would improve the data faster than any public layer.
15. **Offline and low data.** The map library is 790 KB and the data file 534 KB. A family on a
    prepaid phone pays for that. Serve gzip, lazy-load the map, and cache with a service worker.
16. **Print from phone.** iOS Safari prints the paper document correctly; Android Chrome varies.
    A "Save as PDF" that renders server-side would be more reliable.

## Design

17. **Zone overview map.** Done 2026-09-27: the family-facing "Schools that closed" page now has the
    seven-zone map beside the bars, with collision-aware labels.
18. **Empty and error states.** "Address not found" is the only error. Add: data file failed to
    load, map tiles blocked, geocoder rate-limited.
19. **Focus order.** The fixed action bar on the phone is last in the DOM but first in importance.
    Keyboard and screen-reader users reach it after all the crossings.
19a. **Hero silhouette.** A faint map of the seven zones behind the home hero was tried and dropped:
    at desktop widths it sits under the address form and reads as a smudge. If wanted, it needs its
    own row, not a background.
20. **Figma is behind the site.** The wireframes still show the old verdict layout; the staff pages,
    the map picker and the sources page have no frames.

## Engineering

21. **No build step** is a feature for a hackathon, but the strings object in app.js is now large.
    Split strings into en.js and es.js, and screens into their own files, when the team grows.
22. **Tests.** geo.js has none. A small Node test that runs compute() on the seven sample points and
    compares to a stored snapshot would catch regressions in the intersection code.
23. **Data refresh.** data/build.py assumes the team's pulls are in data/. A script that pulls from
    the ArcGIS endpoints in data/meta.json directly would remove that step.
24. **Hosting.** Static, so Cloudflare Pages works as it did for OptiCademy. Set cache headers for
    data/*.json and use hashed file names instead of the ?v= query strings.
