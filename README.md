# Closed-School Walk Check (prototype)

Families type an address and see the walks their child makes now: to the closure shuttle's pickup at the old campus
(through 2027–28), and straight to the new school (for anyone who skips the shuttle, and for everyone once it ends). Each
walk leads with a one-line answer, such as "Crosses train tracks and 1 dangerous road," built from City-listed dangerous roads
and active railroads. The page states the 2028 end date and HISD's Pre-K rule. It gives the family a packet to print, plus
text to paste into HISD's Transportation Support Request Form ("Walk Route Concerns"). The app also has a closed-zone
overview and a ranked list of corridors the City can act on.

Every number is recomputed from public layers. None is copied from `../Report.md`. See `../VERIFY.md` for where the
recomputed numbers agree with the report and where they don't.

## Run

```bash
npm install
npm run data      # pull HISD + City of Houston ArcGIS layers into public/data (snapshot)
npm run grounds   # pull OpenStreetMap school grounds around the shuttle campuses → campus_grounds.geojson
npm run compute   # grid-sample the closed zones → zones.json, corridors.json, shuttles.json, ../VERIFY.md
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ (HashRouter, relative paths — host anywhere)
```

The snapshot in `public/data` is already there, so `npm run dev` works offline without the first two steps.

Add `?lang=es` before the `#` (for example `index.html?lang=es#/`) to open in Spanish, for a flyer link or QR code.

## Who it's for (audience research, 2026-09-26)

- **Families in the old zones, on phones.** Across the seven zones, 49% of households speak Spanish at home and 17% have no home
  internet (ACS 2023, zone-weighted, in the site's reaching-families report). So the family screens come in English and Spanish, open on
  a phone with the map folded away, and have a "Text this" button (an `sms:` link, with no backend and no account). A real SMS or
  WhatsApp line is out of scope for the demo.
- **HISD staff read the packet**, so its body stays in English. The family's instructions above it follow the chosen language.
- **City and HISD staff use the Closed zones and Corridors pages.** Those stay in English and say so in Spanish.
- The copy rules are at the top of `src/lib/i18n.ts`: neither HISD's voice nor a protest's, never "you qualify," plain words.
  The Spanish hasn't been professionally reviewed, and the app says so.
- Questions only people can answer (shuttle stops and times, Pre-K help, who does pickup) are in `../context/Calls-To-Make.md`.

## Layout

- `scripts/fetch-data.ts`: paginated ArcGIS REST pulls. Layer ids are irregular (6, 1, 0, 1, …), and HISD's railroad service is spelled `Texas_Rainroads`.
- `scripts/shuttle-pairs.ts`: HISD's announced closure-shuttle pairings (all 12 campuses), keyed by campus number, with sources and flags.
- `scripts/fetch-grounds.ts`: Overpass pull of OSM school grounds around each shuttle endpoint. It retries and falls back to a mirror, because the main server 504s under load.
- `scripts/compute.ts`: diffs the zones, samples a ~110 m grid, computes the hazard shares and the corridor ranking, and writes the VERIFY report.
- `src/lib/geo.ts`: point-in-polygon, haversine, segment intersection. Shared by the scripts and the browser.
- `src/lib/analyze.ts`: `analyzeAddress()`, the single analysis the precompute and the UI both run.
- `src/components/ShuttleLayer.tsx`: the shuttle layer on the Closed zones map and the address check.
- `src/lib/i18n.ts`: every family-facing sentence in English and Spanish, the copy rules, and display-time translation of the shuttle flags.
- `src/pages/`: Lookup (home), Packet (print), Overview (`/zones`), Corridors.

## Limits (also shown in the UI)

- Routes are straight lines, so every result is a floor. A street route crosses at least as many hazards.
- Shares are of zone **area**, not students or homes. Next step: weight by HCAD residential parcels.
- The tool produces evidence, not an eligibility decision. §48.151 also needs "no walkway", and Houston publishes no sidewalk data.
- Crash data is the City's HIN 2022, the newest the City publishes. The railroad layer was last edited 2024-02-15.
- **Shuttle stops are campus-level.** HISD says the shuttle runs "from their current campus to their receiving school site" and
  has published no stop spot, times, runs or streets. The map shows the pickup campus's grounds (OSM outline), not a curb, and a
  straight connector, not a route. Ross's announced drop-offs (Roosevelt, C. Martinez) differ from the boundary layer (Dogan, Roosevelt).
- The address search uses the keyless ArcGIS World Geocoder. Clicking the map always works as a fallback.
