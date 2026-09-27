// "File it yourself": the page for HISD's online Transportation Support Request Form. The form has one Description box
// and takes no files, so the family pastes a text version of the walk and prints the evidence page for the school. The
// evidence page and the pasted text stay in English because HISD staff read them; the instructions follow the family's
// language.
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useWalkway } from "../lib/ai/walkway";
import { type CrossingStep, type Dir, NEAR_M, type RailKind, SHOW_FAR_M, type WalkPlan, controlLabel, railKind } from "../lib/crossings";
import { roadCorridorTotals, useData } from "../lib/data";
import { dist, mi as miles } from "../lib/format";
import { useT } from "../lib/i18n";
import { reverseGeocode } from "../lib/geocode";
import { type UiResult } from "../lib/ui/model";
import { useUiWalk } from "../lib/ui/useUiWalk";
import { Checking } from "../components/ui/Checking";
import { WalkwayHelper } from "../components/WalkwayHelper";
import { ActionBar, Back, Paper, PrintDoc, useUi } from "../components/ui/bits";

// HISD's family-facing request form. It has a "Walk Route Concerns" subcategory, one Description box and no upload
// (read 2026-09-25; see the measuring-the-request report).
const FAMILY_FORM = "https://portal.laserfiche.com/a6882/forms/TSRFParent";

const LINE_NOTE = "Routes are straight lines, so a walk on streets crosses at least these.";
const ROUTE_NOTE = "Routes are walking routes on mapped streets (OpenRouteService), not checked on foot.";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// The evidence and the pasted text are English whatever the family reads: HISD staff read them.
const DIRS: Record<Dir, string> = { n: "north", ne: "northeast", e: "east", se: "southeast", s: "south", sw: "southwest", w: "west", nw: "northwest" };
const RAIL_KINDS: Record<RailKind, string> = {
  underpass: "the street goes under the tracks",
  bridge: "the street goes over the tracks",
  path: "a crossing for people walking",
  gatesLights: "gates and flashing lights",
  gates: "gates",
  lights: "flashing lights",
  none: "no gates or lights",
};
const ft = (m: number) => dist(m, "en");

/** The "uncontrolled" half of the Texas test, as data: stated either way, including when a light is close by. */
function controlCell(step: CrossingStep) {
  const c = step.control, what = step.hazard.kind === "road" ? "traffic light" : "public rail crossing";
  if (!c) return `No ${what} within ${ft(SHOW_FAR_M)}`;
  const at = c.kind === "signal" ? controlLabel(c) : `${controlLabel(c)} (${RAIL_KINDS[railKind(c.xing)]})`;
  const where = `${at}, ${ft(c.d)} ${DIRS[c.dir]}`;
  return step.near ? `${c.kind === "signal" ? "Traffic light" : "Public crossing"} at ${where}` : `No ${what} within ${ft(NEAR_M)}. Nearest: ${where}`;
}

/** One crossing as a sentence fragment for the text a family pastes into HISD's form. */
function hazardPhrase(step: CrossingStep) {
  const h = step.hazard, c = step.control;
  const what = h.kind === "road" ? "traffic light" : "public rail crossing";
  const control = c && step.near
    ? `nearest ${what} ${ft(c.d)} from where the line crosses, at ${controlLabel(c)}`
    : `no ${what} within ${ft(NEAR_M)} of where the line crosses${c ? ` (nearest ${ft(c.d)} away, at ${controlLabel(c)})` : ""}`;
  if (h.kind === "rail") return `active railroad track (${h.key.slice(5)}; ${control})`;
  const lists = [h.pedDangerous && "City pedestrian-dangerous road", h.highInjury && "City High Injury Network"].filter(Boolean).join(", ");
  return `${h.name} (${lists}; ${plural(h.pedCrashes, "pedestrian crash", "pedestrian crashes")}, ${plural(h.pedDeaths, "death", "deaths")} on the crossed segment; ${control})`;
}
const crossList = (plan: WalkPlan) =>
  plan.steps.length ? plan.steps.map(hazardPhrase).join("; ") : "no road on the City's High Injury Network and no active railroad";

/** The evidence page for HISD, letter size, in /ui's document style. */
function PacketDoc({ r, plan, swPlan, addr, walkway, stopLabel }: { r: UiResult; plan: WalkPlan; swPlan?: WalkPlan; addr: string; walkway: string | null; stopLabel: string | null }) {
  const d = useData();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const Table = ({ p }: { p: WalkPlan }) => (
    <table className="doc-table">
      <thead><tr><th>#</th><th>Road or track</th><th>Nearest traffic light / public rail crossing</th><th>Crossed segment: ped. crashes / deaths</th><th>Whole road on City list</th></tr></thead>
      <tbody>
        {p.steps.map((step, i) => {
          const h = step.hazard;
          const whole = h.kind === "road" ? roadCorridorTotals(d, h.name) : null;
          return (
            <tr key={h.key}>
              <td>{i + 1}</td>
              <td><b>{h.kind === "rail" ? `Active railroad: ${h.key.slice(5)}` : h.name}</b></td>
              <td>{controlCell(step)}</td>
              <td>{h.kind === "road" ? `${h.pedCrashes} / ${h.pedDeaths}` : "n/a"}</td>
              <td>{whole ? `${whole.pedCrashes} / ${whole.pedDeaths} (${whole.miles.toFixed(1)} mi)` : "n/a"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <article className="doc doc-hisd">
      <header className="doc-head">
        <div className="doc-brand"><svg width="22" height="22" className="on-green"><use href="#logo" /></svg><span>Walk Check</span></div>
        <div className="doc-meta"><b className="doc-to">To HISD Transportation</b><br />Walk-route concern: supporting evidence<br />{today}</div>
      </header>
      <h1>Walk to {r.recv.name}: roads and railroads crossed</h1>
      <p className="doc-sub">Prepared from published HISD and City of Houston data. Evidence to attach to a request, not an eligibility decision.</p>
      <dl className="doc-facts">
        <dt>Student name</dt><dd className="doc-blank">&nbsp;</dd>
        <dt>Student ID (S + 7 digits) · grade</dt><dd className="doc-blank">&nbsp;</dd>
        <dt>Parent / guardian and phone</dt><dd className="doc-blank">&nbsp;</dd>
        <dt>Home address</dt><dd>{addr}</dd>
        <dt>2025–26 zoned school</dt><dd>{r.closed.name}, {r.closed.address}: closed after 2025–26. {miles(r.distBeforeM)} {r.pathBefore ? "walking route" : "straight-line"}.</dd>
        <dt>2026–27 zoned school</dt><dd>{r.recv.name}, {r.recv.address}. {miles(r.distNowM)} {r.path ? "walking route" : "straight-line"}.</dd>
      </dl>
      <h2>Roads and railroads the walk to school crosses</h2>
      {plan.steps.length ? <Table p={plan} /> : <p>The {r.path ? "walking route" : "straight-line walk"} crosses no road on the City's High Injury Network and no active railroad.</p>}
      {swPlan && (
        <>
          <h2>Walk to the closure shuttle pickup (2026–27 and 2027–28)</h2>
          <p>HISD's closure shuttle picks up at {r.closed.name}, {r.closed.address}. HISD hasn't published the stop's exact location or times.</p>
          {swPlan.steps.length > 0 && <Table p={swPlan} />}
        </>
      )}
      <h2>Walkway conditions ({walkway ? "family's description" : "family to complete"})</h2>
      {walkway ? <p>{walkway}</p> : <><p>Is there a sidewalk along the route? Where does the child cross? Traffic, trucks, lighting, crossing guards:</p><div className="doc-lines"><i /><i /><i /></div></>}
      <h2>Proposed bus stop</h2>
      <p>{stopLabel ?? addr}</p>
      <footer className="doc-foot">
        <span>{r.path ? ROUTE_NOTE : LINE_NOTE} Tex. Educ. Code §48.151 also asks about walkways; Houston publishes no sidewalk data. HISD decides.</span>
        <span>Sources: HISD 2026–27 boundaries; City of Houston Vision Zero HIN 2022; TranStar signals; FRA crossings; snapshot {d.meta.fetchedAt.slice(0, 10)}</span>
      </footer>
    </article>
  );
}

/** The form's one Description box, as editable text with a copy button. */
function CopyBox({ text }: { text: string }) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.value ?? text);
      setState("copied");
    } catch {
      ref.current?.select();
      setState("failed");
    }
  }
  return (
    <div className="copybox">
      <h2>{t.packet.copyTitle}</h2>
      {t.packet.copyNote && <p className="small muted">{t.packet.copyNote}</p>}
      <p className="small muted">{t.packet.addSidewalk}</p>
      {/* Editable, so the family can change the wording before copying. It resets if the walkway sentence changes. */}
      <textarea key={text} ref={ref} className="input" defaultValue={text} rows={9} lang="en" />
      <button type="button" className="btn secondary" onClick={copy}>{t.packet.copy}</button>
      {state === "copied" && <p className="small">{t.packet.copied}</p>}
      {state === "failed" && <p className="small">{t.packet.copyFailed}</p>}
    </div>
  );
}

export default function Packet() {
  const u = useUiWalk();
  const { t } = useT();
  const { L } = useUi();
  const tp = t.packet;
  const [walkway] = useWalkway(u ? `${u.w.home[0]},${u.w.home[1]}` : "");
  const [stopLabel, setStopLabel] = useState<string | null>(null);
  const home = u?.w.home;
  useEffect(() => {
    if (home) reverseGeocode(home).then(setStopLabel);
  }, [home?.[0], home?.[1]]);
  if (u?.w.pending) return <Checking />;
  if (!u?.r || !u.w.nowPlan) return <Navigate to="/" replace />;
  const { w, r, addr } = u;
  const plan = w.nowPlan!;
  const copyText = [
    `Walk Route Concerns: walk to ${r.recv.name}, 2026–27.`,
    `Home address: ${addr}.`,
    `This address was zoned to ${r.closed.name}, which closed after 2025–26. It is now zoned to ${r.recv.name}.`,
    `Walk to ${r.recv.name}: ${miles(r.distNowM)} ${r.path ? "along a walking route" : "in a straight line"}. It crosses ${crossList(plan)}.`,
    w.sw && w.swPlan && `While HISD's closure shuttle runs (2026–27 and 2027–28), the walk to its pickup at ${r.closed.name} is ${miles(r.distBeforeM)} ${r.pathBefore ? "along a walking route" : "in a straight line"} and crosses ${crossList(w.swPlan)}.`,
    walkway && `Walkway conditions (family's description): ${walkway}`,
    `Proposed bus stop: ${stopLabel ?? addr}.`,
    `Sources: HISD 2026–27 elementary boundaries and campus points; HISD Texas Railroads layer; City of Houston Vision Zero High Injury Network 2022; ` +
      `traffic signals from Houston TranStar's signal map; FRA Crossing Inventory. ${r.path ? ROUTE_NOTE : LINE_NOTE} ` +
      `The family has a printed copy.`,
  ].filter(Boolean).join("\n");
  const doc = <PacketDoc r={r} plan={plan} swPlan={w.sw ? w.swPlan : undefined} addr={addr} walkway={walkway} stopLabel={stopLabel} />;

  return (
    <section className="screen has-bar">
      <PrintDoc>{doc}</PrintDoc>
      <Back />
      <h1>{tp.way1Title.replace(/^1\.\s*/, "")}</h1>
      <div className="cols">
        <div className="col">
          <p>{tp.way1Before}<a href={FAMILY_FORM} target="_blank" rel="noreferrer">{tp.way1Link}</a>{tp.way1After}</p>
          <p className="muted">{tp.timing}</p>
          <WalkwayHelper />
          <CopyBox text={copyText} />
        </div>
        <div className="col side">
          <Paper pages={L.page1}>{doc}</Paper>
          <ActionBar btns={[{ label: tp.print, primary: true, onClick: () => window.print() }]} />
        </div>
      </div>
    </section>
  );
}
