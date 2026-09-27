import { useState } from "react";
import { GeoJSON, Marker, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { reverseGeocode } from "../lib/geocode";
import type { LngLat } from "../lib/geo";
import { useT } from "../lib/i18n";
import { firstScreen } from "../lib/walk";
import { COLORS, FitTo, MapBase, pinIcon } from "../components/MapBase";
import { Back } from "../components/WalkCheck";

function ClickToSet({ onPick }: { onPick: (p: LngLat) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lng, e.latlng.lat]) });
  return null;
}

/** Pick the home on a map: tap to drop a pin, move it if needed, then use it. The fallback when the address search misses. */
export default function Pick() {
  const d = useData();
  const { t } = useT();
  const nav = useNavigate();
  const [pt, setPt] = useState<LngLat | null>(null);
  const [busy, setBusy] = useState(false);
  const use = async () => {
    if (!pt) return;
    setBusy(true);
    const label = await reverseGeocode(pt);
    setBusy(false);
    nav(firstScreen(pt, label ?? `${pt[1].toFixed(5)}, ${pt[0].toFixed(5)}`, d));
  };
  return (
    <section className="screen has-bar">
      <Back />
      <h1>{t.wc.pickH}</h1>
      <p className="lede-wc">{t.wc.pickSub}</p>
      <div className="walk-map pick-map">
        <MapBase>
          <ClickToSet onPick={setPt} />
          {d.zones.map((z) => (
            <GeoJSON key={z.nbr} data={{ type: "Polygon", coordinates: z.rings } as any} style={{ color: COLORS.zone, weight: 2, fillOpacity: 0.12 }} interactive={false} />
          ))}
          {pt && (
            <Marker position={[pt[1], pt[0]]} icon={pinIcon("⌂", "pin-home")} draggable
              eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setPt([p.lng, p.lat]); } }} />
          )}
          <FitTo points={d.zones.flatMap((z) => z.rings[0])} />
        </MapBase>
      </div>
      <div className="bar-fixed">
        <button type="button" className="btn primary" disabled={!pt || busy} onClick={use}>{busy ? t.wc.finding : t.wc.useSpot}</button>
      </div>
    </section>
  );
}
