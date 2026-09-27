import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { walkingFitPoints } from "../lib/useWalkingAddress";
import { RouteStatus, routeDistanceText } from "../components/RouteStatus";
import { type CrossingStep, NEAR_M, SHOW_FAR_M, type WalkPlan, controlLabel, railKind } from "../lib/crossings";
import { roadCorridorTotals, useData } from "../lib/data";
import { reverseGeocode } from "../lib/geocode";
import { coord, dist, mi, signedMi } from "../lib/format";
import { DICTS, LangContext, useT } from "../lib/i18n";
import { FitTo, MapBase, MapLegend } from "../components/MapBase";
import { shuttlePoints } from "../components/ShuttleLayer";
import { RouteLayers } from "../components/RouteLayers";
import { useWalk } from "../lib/walk";

// HISD's family-facing request form. It has a "Walk Route Concerns" subcategory, one Description box and no upload
// (read 2026-09-25; see the measuring-the-request report). The principal's route is CNA(EXHIBIT), Exhibit B.
const FAMILY_FORM = "https://portal.laserfiche.com/a6882/forms/TSRFParent";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The packet body is English whatever the family reads: HISD staff read it.
const EN = DICTS.en.cross;
const ft = (m: number) => dist(m, "en");

/**
 * The "uncontrolled" half of the Texas test, as data: the nearest traffic light on the crossed road, or the nearest
 * public crossing of the crossed railroad. Stated either way, including when a light is close by.
 */
function controlCell(step: CrossingStep) {
  const c = step.control, what = step.hazard.kind === "road" ? "traffic light" : "public rail crossing";
  if (!c) return `No ${what} within ${ft(SHOW_FAR_M)}`;
  const at = c.kind === "signal" ? controlLabel(c) : `${controlLabel(c)} (${EN.railKinds[railKind(c.xing)]})`;
  const where = `${at}, ${ft(c.d)} ${EN.dirs[c.dir]}`;
  return step.near ? `${c.kind === "signal" ? "Traffic light" : "Public crossing"} at ${where}` : `No ${what} within ${ft(NEAR_M)}. Nearest: ${where}`;
}

/** One crossing as a sentence fragment for the text a family pastes into HISD's form. */
function hazardPhrase(step: CrossingStep) {
  const h = step.hazard, c = step.control;
  const what = h.kind === "road" ? "traffic light" : "public rail crossing";
  const control = c && step.near
    ? `nearest ${what} ${ft(c.d)} from the mapped intersection, at ${controlLabel(c)}`
    : `no ${what} within ${ft(NEAR_M)} of the mapped intersection${c ? ` (nearest ${ft(c.d)} away, at ${controlLabel(c)})` : ""}`;
  if (h.kind === "rail") return `active railroad track (${h.key.slice(5)}; ${control})`;
  const lists = [h.pedDangerous && "City pedestrian-dangerous road", h.highInjury && "City High Injury Network"].filter(Boolean).join(", ");
  return `${h.name} (${lists}; ${plural(h.pedCrashes, "pedestrian crash", "pedestrian crashes")}, ${plural(h.pedDeaths, "death", "deaths")} on the intersected segment; ${control})`;
}
const crossList = (plan: WalkPlan) =>
  plan.steps.length ? plan.steps.map(hazardPhrase).join("; ") : "no road on the City's High Injury Network and no active railroad";

function HazardTable({ plan, newlyCrossed = [] }: { plan: WalkPlan; newlyCrossed?: { key: string }[] }) {
  const d = useData();
  return (
    <table className="data">
      <thead>
        <tr><th>#</th><th>Road or track</th><th>Listed as</th><th>Nearby traffic light / public rail crossing (access unverified)</th><th>Intersected segment: ped. crashes / deaths</th><th>Whole road on City list: ped. crashes / deaths</th></tr>
      </thead>
      <tbody>
        {plan.steps.map((step, i) => {
          const h = step.hazard;
          const whole = h.kind === "road" ? roadCorridorTotals(d, h.name) : null;
          return (
            <tr key={h.key}>
              <td>{i + 1}</td>
              <td>{h.kind === "rail" ? `Active railroad: ${h.key.slice(5)}` : h.name}{newlyCrossed.some((n) => n.key === h.key) ? " *" : ""}</td>
              <td>{[h.kind === "rail" && "Active railroad", h.pedDangerous && "Pedestrian-dangerous", h.highInjury && "High Injury Network"].filter(Boolean).join("; ")}</td>
              <td>{controlCell(step)}</td>
              <td>{h.kind === "road" ? `${h.pedCrashes} / ${h.pedDeaths}` : "n/a"}</td>
              <td>{whole ? `${whole.pedCrashes} / ${whole.pedDeaths} (${whole.miles.toFixed(1)} mi)` : "n/a"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Text for the form's one Description box: the packet in a paragraph, in English because HISD staff read it. */
function CopyBox({ text }: { text: string }) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const value = ref.current?.value ?? text;
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      ref.current?.select();
      setState("failed");
    }
  }
  return (
    <div className="copybox">
      <h3>{t.packet.copyTitle}</h3>
      {t.packet.copyNote && <p className="small">{t.packet.copyNote}</p>}
      <p className="small">{t.packet.addSidewalk}</p>
      {/* Editable, so the family can add the sidewalk sentence before copying. Resets if the stop moves. */}
      <textarea key={text} ref={ref} defaultValue={text} rows={9} lang="en" />
      <button type="button" className="button" onClick={copy}>{t.packet.copy}</button>{" "}
      {state === "copied" && <span className="small">{t.packet.copied}</span>}
      {state === "failed" && <span className="small">{t.packet.copyFailed}</span>}
    </div>
  );
}

export default function Packet() {
  const d = useData();
  const { t, setLang } = useT();
  const tp = t.packet;
  const w = useWalk();
  const stop = w?.stop;
  const [stopLabel, setStopLabel] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setStopLabel(null);
    if (stop) reverseGeocode(stop).then((label) => { if (active) setStopLabel(label); }, () => {});
    return () => { active = false; };
  }, [stop?.[0], stop?.[1]]);

  if (!w?.r.now || !stop)
    return (
      <div className="page">
        <p>{t.plan.missing} <Link to="/">{t.plan.start}</Link>.</p>
      </div>
    );

  const { r, home, addr, params, shuttle, sw, swPlan } = w;
  const now = w.r.now;
  const hz = now.hazards;
  const plan = w.nowPlan!;
  const roads = hz.filter((h) => h.kind === "road");
  const rails = hz.filter((h) => h.kind === "rail");
  const ped = roads.filter((h) => h.pedDangerous);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const m = d.meta;
  const oldName = r.old?.school.name ?? "";

  const summary = [
    roads.length > 0 &&
      `${roads.length} road${roads.length > 1 ? "s" : ""} on the City of Houston Vision Zero High Injury Network` +
        (ped.length ? `, ${ped.length} of them designated pedestrian-dangerous (${ped.map((h) => h.name).join(", ")})` : ""),
    rails.length > 0 && `active railroad track (${rails.map((h) => h.key.slice(5)).join("; ")})`,
  ].filter(Boolean);

  const copyText = [
    `Walk Route Concerns: walk to ${now.school.name}, 2026–27.`,
    `Home address: ${addr} (${coord(home)}).`,
    r.closedZone && r.old && `This address was zoned to ${oldName}, which closed after 2025–26. It is now zoned to ${now.school.name}.`,
    `Walk to ${now.school.name}: ${routeDistanceText(now, DICTS.en)}. Potential map intersections: ${crossList(plan)}.`,
    sw && swPlan && `While HISD's closure shuttle runs (2026–27 and 2027–28), the walk to its pickup at ${oldName} is ${routeDistanceText(sw, DICTS.en)}. Potential map intersections: ${crossList(swPlan)}.`,
    ...[now, ...(sw ? [sw] : [])].map((route) => `${route.school.name}: ${DICTS.en.routing[route.routing?.status ?? "unavailable"]}${route.routing?.status === "ready" ? " " + DICTS.en.routing.endpoints(Math.round(route.routing.route.startGapM), Math.round(route.routing.route.endGapM)) : ""}`),
    `Proposed bus stop: ${stopLabel ?? coord(stop)} (${coord(stop)}).`,
    `Sources: HISD 2026–27 elementary boundaries and campus points; HISD Texas Railroads layer; City of Houston Vision Zero High Injury Network 2022; ` +
      `traffic signals from Houston TranStar's signal map; FRA Crossing Inventory. ` +
      `Walking geometry: openrouteservice / OpenStreetMap when available; otherwise explicitly labeled straight-line estimates. ${DICTS.en.routing.caveat} The family has a printed map.`,
  ].filter(Boolean).join("\n");

  return (
    <div className="page packet">
      <div className="no-print packet-actions">
        <Link to={`/walk?${params}`} className="button">{tp.back}</Link>
        <button type="button" className="button primary" onClick={() => window.print()}>{tp.print}</button>
      </div>

      <section className="no-print how-to">
        <h2>{tp.howTitle}</h2>
        <p>{tp.howIntro}</p>
        <h3>{tp.way1Title}</h3>
        <p>{tp.way1Before}<a href={FAMILY_FORM} target="_blank" rel="noreferrer">{tp.way1Link}</a>{tp.way1After}</p>
        <h3>{tp.way2Title}</h3>
        <p>{tp.way2(now.school.name)}</p>
        <p className="small">{tp.timing}</p>
        <CopyBox text={copyText} />
        {tp.printNote && <p className="small">{tp.printNote}</p>}
      </section>

      {/* The printed page is for HISD staff, so everything below renders in English whatever the family reads. */}
      <LangContext.Provider value={{ lang: "en", setLang }}>
        <div lang="en">
          <header className="packet-head">
            <p className="eyebrow">Walk-route concern: supporting evidence for HISD Transportation</p>
            <h1>Walk to {now.school.name}: potential road and rail intersections</h1>
            <p className="small">Prepared {today} from published HISD and City of Houston data. This is evidence to attach to a request, not an eligibility decision.</p>
            <div className="fill-in">
              <span>Student name: <i /></span>
              <span>Student ID (S + 7 digits): <i /></span>
              <span>Grade: <i /></span>
              <span>Parent / guardian and phone: <i /></span>
            </div>
          </header>

          <section>
            <h2><span className="num">1</span> Geographic area</h2>
            <table className="kv">
              <tbody>
                <tr><th>Home address</th><td>{addr}</td></tr>
                <tr><th>Coordinates</th><td>{coord(home)}</td></tr>
                {r.closedZone && r.old && (
                  <tr><th>2025–26 zoned school</th><td>{oldName}, {r.old.school.address}: closed after 2025–26. {mi(r.old.distance)} straight-line.</td></tr>
                )}
                <tr><th>2026–27 zoned school</th><td>{now.school.name}, {now.school.address}. {mi(now.distance)} straight-line{r.closedZone && r.old ? ` (${signedMi(now.distance - r.old.distance)})` : ""}.</td></tr>
              </tbody>
            </table>
          </section>

          <section className="conditions">
            <h2><span className="num">2</span> Dangerous conditions</h2>
            <RouteStatus route={now} />
            <p>{routeDistanceText(now, DICTS.en)}</p>
            {summary.length ? (
              <p>The displayed geometry from this home to {now.school.name} has potential intersections with {summary.join(", and ")}. These are not confirmed at-grade crossings.</p>
            ) : (
              <p>No intersections with listed roads or active railroads were found in the displayed geometry. Other hazards may exist; describe conditions below.</p>
            )}
            {hz.length > 0 && <HazardTable plan={plan} newlyCrossed={r.closedZone ? r.newlyCrossed : []} />}
            {r.closedZone && r.newlyCrossed.length > 0 && <p className="small">* Not intersected by the mapped walking route to the former school, {oldName}.</p>}

            {sw && (
              <div className="shuttle-walk">
                <h3>Walk to the closure shuttle pickup (2026–27 and 2027–28)</h3>
                <RouteStatus route={sw} />
                <p>{routeDistanceText(sw, DICTS.en)}</p>
                <p>
                  HISD's closure shuttle picks up at {oldName}, {sw.school.address}, {mi(sw.distance)} straight-line from this home. HISD hasn't
                  published the stop's exact location or times. {sw.hazards.length ? "Potential intersections in the displayed geometry:" : "No listed hazard intersections found in the displayed geometry."}
                </p>
                {swPlan && sw.hazards.length > 0 && <HazardTable plan={swPlan} />}
              </div>
            )}

            <div className="write-in">
              <p><strong>Walkway conditions (family to complete).</strong> Is there a sidewalk along the route? Where does the child cross? Traffic, trucks, lighting, crossing guards:</p>
              <i /><i /><i />
            </div>
          </section>

          <section>
            <h2><span className="num">3</span> Proposed bus stop location</h2>
            <table className="kv">
              <tbody>
                <tr><th>Location</th><td>{stopLabel ?? "Nearest address lookup unavailable"}</td></tr>
                <tr><th>Coordinates</th><td>{coord(stop)}{stop[0] === home[0] && stop[1] === home[1] ? " (at the home)" : ""}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="map-section">
            <h2><span className="num">4</span> Map</h2>
            <MapBase className="map print-map" interactive={false}>
              <RouteLayers d={d} r={r} stop={stop} shuttle={sw ? shuttle : undefined} />
              <FitTo points={[...walkingFitPoints(r), stop, ...(sw && shuttle ? shuttlePoints([shuttle]) : [])]} />
            </MapBase>
            <p className="small">
              ⌂ home · S proposed stop · 26 = {now.school.name} (blue line)
              {r.old && r.closedZone ? ` · ${sw ? "bus pin" : "25"} = ${oldName}${sw ? ", the closure shuttle pickup" : ""} (dashed gray line)` : ""} · ○ potential hazard intersection or mapped route endpoint
            </p>
            <p className="small">{DICTS.en.routing.mapNote}</p>
            <MapLegend shuttle={!!sw} walks />
          </section>

          <footer className="packet-foot">
            <p><strong>How this reaches HISD.</strong> The family can file HISD's Transportation Support Request Form under "Walk Route Concerns," pasting a text version of this page (the form takes no uploads), and can give this printout to the campus. A principal can also start a hazardous-route request for the area under HISD policy CNA, Exhibit B.</p>
            <p><strong>Method and limits.</strong> Walking routes follow the mapped pedestrian network when available. Fallbacks are straight-line estimates; their hazard sets can differ. Intersections are geometric and may include bridges or tunnels. Access between pins and network endpoints is unverified. Nearby traffic controls are context, not instructions to leave the route. Straight-line distances remain separate for existing distance-rule estimates. Texas's hazardous-traffic test (Tex. Educ. Code §48.151) also depends on whether a walkway exists. Houston publishes no sidewalk data, so the family's description above is the only evidence for it. "Nearest traffic light" covers signals only: crossing guards, stop signs and marked crosswalks aren't in any public Houston layer. HISD's transportation department and board decide eligibility.</p>
            <p><strong>Sources.</strong> HISD GIS: elementary boundaries 2025–26 (edited {m.zones_old.lastEditDate}) and 2026–27 (edited {m.zones_new.lastEditDate}); campus points 2025–26 and 2026–27 (edited {m.schools_new.lastEditDate}); Texas Railroads, active segments (edited {m.rail.lastEditDate}). City of Houston Vision Zero: Ped Dangerous Roads (HIN 2022) and High Injury Network 2022. Traffic signals: City of Houston, TxDOT and Harris County via Houston TranStar's signal map (read {m.signals?.readOn ?? "unknown"}; the feed carries no date). Rail crossings: FRA Crossing Inventory (updated {m.rail_crossings?.lastEditDate ?? "unknown"}). Closure shuttle: HISD's announced pairings. Snapshot taken {m.fetchedAt.slice(0, 10)}.</p>
          </footer>
        </div>
      </LangContext.Provider>
    </div>
  );
}
