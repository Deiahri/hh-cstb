# Walk Check UI (static)

This folder is a standalone static version of the Walk Check UI. It runs on its own, with no build
step, and reads the same public data as the React app (see `public/data` at the repo root).

Type a Houston address. See what a child's walk to the receiving school crosses after HISD's seven
elementary closures, where to cross each road or track, and get the two requests a principal can
send: HISD's hazardous-route bus request and Houston Public Works' school zone application.

Static site, no build step, no framework. Phone first, light theme, prints only real documents.

## Run

```
cd ui
python3 serve.py
open http://localhost:5197
```

`serve.py` sends no-cache headers so edits show on plain reload. Any static host works for deploys.

## Files

- `index.html` shell: fonts, logo symbol, splash, header, `#app`, `#print-root`.
- `styles.css` tokens, components, map styling, print rules.
- `geo.js` geometry: point-in-zone, straight-line intersections with the City's crash lists and the
  rail layer, nearest traffic light or public rail crossing. Loads `data/walk.json` once.
- `app.js` hash router, bilingual strings, screens, documents, maps, share.
- `data.js` hand-researched contacts: receiving-school principals, Super Neighborhood councils,
  HISD closure family line, HPW email. Verify before printing.
- `data/build.py` trims the pulls in `../public/data` into `data/walk.json`. `corridors.json`,
  `zone_requests.json` and `meta.json` are small copies read directly by the staff pages; re-copy
  them when the data job runs again.

## Routes

`#/` home · `#/pick` map picker · `#/prek` · `#/walk?lat&lng&addr&prek` · `#/help` · `#/bus` ·
`#/schoolzone` · `#/zones` · `#/zone/:nbr` · `#/data` · `#/corridors` · `#/april15` · `#/draft/:nbr` ·
`#/sources` · `#/nozone`

## Services

- Geocoding: OpenStreetMap Nominatim, bounded to greater Houston. Light use only; the map picker is
  the fallback.
- Map: MapLibre GL from cdnjs with OpenFreeMap's Positron style (no key). Overlays are drawn from
  `data/walk.json`.
