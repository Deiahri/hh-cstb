import { Marker, Tooltip } from "react-leaflet";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import type { LngLat } from "../lib/geo";
import { shareUrl, useT } from "../lib/i18n";
import { type Walk, crossCounts, useWalk, zoneStreets } from "../lib/walk";
import { FitTo, MapBase, pinIcon } from "../components/MapBase";
import { RouteLayers } from "../components/RouteLayers";
import { hazardName } from "../components/HazardList";
import { Back, ShareButton } from "../components/WalkCheck";
import { MissingWalk } from "./Walk";
import { nextDeadline } from "./April15";

const ll = ([x, y]: LngLat) => [y, x] as [number, number];

/** Who to hand it to. HISD names no principal in its public layers, so the card names the role and the school. */
function PrincipalCard({ w }: { w: Walk }) {
  const { t } = useT();
  const s = w.r.now!.school;
  return (
    <div className="card">
      <span className="k">{t.wc.give}</span>
      <span className="v">{t.wc.principalOf(s.name)}</span>
      <span className="muted small">{s.address} · {t.wc.office}</span>
    </div>
  );
}

function SchoolShare({ w }: { w: Walk }) {
  const { lang, t } = useT();
  const c = crossCounts(w.r.now!.hazards);
  return <ShareButton title={t.wc.shareSchool} text={t.wc.msgSchool(w.r.now!.school.name, t.result.crosses(c.rail, c.roads), shareUrl(lang).replace(/#\/\w+/, "#/walk"))} label={t.wc.share} />;
}

/** Can any road on this walk get a City school zone? "none" when there are roads and none can; "noRoads" when there are none. */
function zoneStatus(z: ReturnType<typeof zoneStreets>) {
  if (!z.length) return "noRoads" as const;
  return z.every((x) => x.possible === false) ? ("none" as const) : ("some" as const);
}

/** The two asks: HISD for a bus stop (hazardous-route request), the City for a school zone (principal, by April 15). */
export function Help() {
  const d = useData();
  const w = useWalk();
  const { t } = useT();
  if (!w?.r.now) return <MissingWalk />;
  const wc = t.wc;
  const status = zoneStatus(zoneStreets(d, w));
  return (
    <section className="screen">
      <Back />
      <h1>{wc.helpH1}</h1>
      <div className="cols">
        <div className="col">
          <p className="muted">{wc.helpSub}</p>
          <div className="card tint big">
            <h2>{wc.busH}</h2>
            <p>{wc.busSub}</p>
            {w.prek && <p className="small">{wc.busPrek}</p>}
            <div className="row">
              <Link className="btn" to={`/bus?${w.params}`}>{wc.inside}</Link>
            </div>
          </div>
          <div className="card warm big">
            <h2 style={{ color: "var(--ink)" }}>{wc.zoneH}</h2>
            <p>{wc.zoneSub}</p>
            {status === "some" && <span className="pill">{wc.deadlinePill}</span>}
            {status === "none" && <p className="small">{wc.zoneNone}</p>}
            {status === "noRoads" && <p className="small">{wc.zoneNoRoads}</p>}
            {status !== "noRoads" && (
              <div className="row">
                <Link className={`btn${status === "some" ? "" : " secondary"}`} to={`/schoolzone?${w.params}`}>{wc.inside}</Link>
              </div>
            )}
          </div>
        </div>
        <div className="col side">
          <PrincipalCard w={w} />
          <SchoolShare w={w} />
        </div>
      </div>
    </section>
  );
}

/** Ask HISD for a bus: what the page for HISD holds, and the suggested stop, dragged on the map. */
export function Bus() {
  const d = useData();
  const w = useWalk();
  const { t } = useT();
  const nav = useNavigate();
  if (!w?.r.now) return <MissingWalk />;
  const wc = t.wc, tr = t.result;
  const setStop = (p: LngLat | null) => {
    const q = new URLSearchParams(w.params);
    if (p) { q.set("slat", p[1].toFixed(6)); q.set("slng", p[0].toFixed(6)); } else { q.delete("slat"); q.delete("slng"); }
    nav(`/bus?${q}`, { replace: true });
  };
  const items = wc.busItems.filter((_, i) => i !== 2 || !!w.sw);
  return (
    <section className="screen has-bar">
      <Back />
      <h1>{wc.busH}</h1>
      <div className="cols">
        <div className="col">
          {w.prek && <div className="card warm edge"><span>{wc.busPrek}</span></div>}
          <PrincipalCard w={w} />
          <h2>{wc.insideH}</h2>
          <ul className="inside-list">{items.map((i) => <li key={i}>{i}</li>)}</ul>
          <h2>{tr.stopTitle}</h2>
          <p>{tr.stopBody} <button type="button" className="linkbtn" onClick={() => setStop(null)}>{tr.resetStop}</button></p>
          <div className="walk-map">
            <MapBase>
              <RouteLayers d={d} r={w.r} shuttle={w.shuttle} />
              <Marker
                position={ll(w.stop)}
                icon={pinIcon("S", "pin-stop")}
                draggable
                eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setStop([p.lng, p.lat]); } }}
              >
                <Tooltip>{t.lookup.dragStop}</Tooltip>
              </Marker>
              <FitTo points={[w.home, w.r.now.school.loc, ...(w.r.old ? [w.r.old.school.loc] : [])]} />
            </MapBase>
          </div>
        </div>
        <div className="col side">
          <p className="small">{wc.busHow}</p>
          <div className="bar-fixed">
            <Link className="btn primary" to={`/packet?${w.params}`}>{wc.openPacket}</Link>
            <SchoolShare w={w} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ask the City for a school zone: the deadline, each road on the walk against HPW's written rules, and the principal's draft. */
export function SchoolZone() {
  const d = useData();
  const w = useWalk();
  const { t } = useT();
  if (!w?.r.now) return <MissingWalk />;
  const wc = t.wc;
  const streets = zoneStreets(d, w);
  const status = zoneStatus(streets);
  const school = w.r.now.school;
  const hasDraft = d.zoneRequests.schools.some((s) => s.nbr === school.nbr && s.streets.length > 0);
  const pathText = (s: (typeof streets)[number]) =>
    s.owner && s.owner !== "COH" ? wc.path.notCity(s.owner)
      : s.path === "borders" ? wc.path.borders
        : s.path === "thoroughfare-collector" ? wc.path.thoroughfare
          : s.path === "neither" ? wc.path.neither : wc.path.unknown;
  return (
    <section className="screen has-bar">
      <Back />
      <h1>{wc.zoneH}</h1>
      <div className="cols">
        <div className="col">
          <div className="stat warm">
            <span className="t" style={{ fontSize: 22, fontWeight: 800 }}>{wc.zoneDeadline(nextDeadline().year)}</span>
            <span className="s">{wc.zoneDeadlineSub}</span>
          </div>
          {status === "none" && <div className="card"><span>{wc.zoneNone}</span></div>}
          {status === "noRoads" && <div className="card"><span>{wc.zoneNoRoads}</span></div>}
          {streets.length > 0 && (
            <>
              <h2>{wc.streets}</h2>
              <ol className="crossing-plan">
                {streets.map((s) => (
                  <li key={s.hazard.key} className={`road ${s.possible ? "near" : "far"}`}>
                    <div className="hz-name">{hazardName(s.hazard, t)}</div>
                    <p className="cross-line">{pathText(s)}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
          {hasDraft && <p>{wc.draft(school.name)}</p>}
        </div>
        <div className="col side">
          <PrincipalCard w={w} />
          <div className="bar-fixed">
            {hasDraft && <Link className="btn primary" to="/april-15" state={{ openDraft: school.nbr }}>{wc.openDraft}</Link>}
            <SchoolShare w={w} />
          </div>
        </div>
      </div>
    </section>
  );
}
