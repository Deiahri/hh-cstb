import { Fragment } from "react";
import { CircleMarker, GeoJSON, Marker, Polyline, Tooltip } from "react-leaflet";
import type { ShuttleEnd, ShuttleStat } from "../lib/data";
import type { LngLat } from "../lib/geo";
import { dataText, useT } from "../lib/i18n";
import { COLORS, pinIcon } from "./MapBase";

const ll = ([x, y]: LngLat) => [y, x] as [number, number];

// Material "directions_bus" glyph (Apache-2.0).
const BUS =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12v5z"/></svg>';
export const busIcon = () => pinIcon(BUS, "pin-shuttle");

export const NOT_PUBLISHED = "HISD hasn't published where on campus the shuttle stops, or when it runs.";
export const ASK = "HISD's closure family line: 713-556-7121.";

function Grounds({ end }: { end: ShuttleEnd }) {
  if (!end.grounds) return null;
  return (
    <GeoJSON
      data={{ type: "MultiPolygon", coordinates: end.grounds } as any}
      style={{ color: COLORS.shuttleInk, weight: 2, fillColor: COLORS.shuttle, fillOpacity: 0.35 }}
      interactive={false}
    />
  );
}

/**
 * HISD's closure shuttles. Each end is a campus: the pickup is the closed (2025–26) campus, the drop-off the
 * receiving one. The grounds outline marks the area the stop is somewhere on; nothing here marks a curb.
 * `hideDropAt` skips the drop-off dot at a campus the page already pins (Lookup's 2026–27 school).
 */
export function ShuttleLayer({ shuttles, hideDropAt }: { shuttles: ShuttleStat[]; hideDropAt?: number }) {
  const { lang, t } = useT();
  const m = t.shuttleMap;
  const grades = (g: string | null) => (g ? dataText(lang, g) : null);
  return (
    <>
      {shuttles.map((s) => (
        <Fragment key={s.from.nbr}>
          <Grounds end={s.from} />
          {s.to.map((to) => (
            <Fragment key={to.nbr + to.name}>
              <Grounds end={to} />
              {!s.sameSite && (
                <>
                  <Polyline positions={[ll(s.from.loc), ll(to.loc)]} pathOptions={{ color: COLORS.shuttleInk, weight: 6, opacity: 0.85 }} interactive={false} />
                  <Polyline positions={[ll(s.from.loc), ll(to.loc)]} pathOptions={{ color: COLORS.shuttle, weight: 3 }}>
                    <Tooltip sticky>{m.line(s.from.name, to.name, to.miles.toFixed(2))}</Tooltip>
                  </Polyline>
                </>
              )}
              {to.nbr !== hideDropAt && (
                <CircleMarker center={ll(to.loc)} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS.newRoute, fillOpacity: 1 }}>
                  <Tooltip>
                    <strong>{m.dropOff(to.name)}</strong>
                    {to.grades && <> ({grades(to.grades)})</>}
                    <br />{m.exactSpot(to.address)}
                  </Tooltip>
                </CircleMarker>
              )}
            </Fragment>
          ))}
          <Marker position={ll(s.from.loc)} icon={busIcon()}>
            <Tooltip>
              {s.sameSite ? (
                <>
                  <strong>{s.from.name} → {s.to.map((x) => x.name).join(", ")}</strong>
                  <br />{m.sameSite(s.from.address)}
                </>
              ) : (
                <>
                  <strong>{m.pickup(s.from.name)}</strong> {m.closedOrMoved}
                  <br />{m.somewhere(s.from.address)}
                  <br />{t.result.notPublished}
                  <br />{m.to}{s.to.map((x) => (x.grades ? `${x.name} (${grades(x.grades)})` : x.name)).join("; ")}
                </>
              )}
              {s.flags.map((f) => <Fragment key={f}><br /><em>{dataText(lang, f)}</em></Fragment>)}
            </Tooltip>
          </Marker>
        </Fragment>
      ))}
    </>
  );
}

/** Every point a shuttle touches, for fitting the map. */
export const shuttlePoints = (shuttles: ShuttleStat[]): LngLat[] => shuttles.flatMap((s) => [s.from.loc, ...s.to.map((t) => t.loc)]);
