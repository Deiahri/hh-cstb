// The pages for City and HISD staff, in English: the closed zones' numbers, the corridors, Before April 15, and one
// receiving school's draft school-zone application.
import { Link, NavLink, useParams } from "react-router-dom";
import { type CorridorStat, type StreetRequest, useData } from "../lib/data";
import { HISD_FAQ, HPW_EMAIL } from "../lib/ui/contacts";
import { closedZones, ft, mi, short } from "../lib/ui/model";
import { NarrativeDraft, StaffAsk, rowPicker } from "../components/StaffAsk";
import { ActionBar, Back, Paper, PrintDoc, useUi } from "../components/ui/bits";
import { ZoneDoc } from "../components/ui/docs";
import { WcMap, usePhone } from "../components/ui/WcMap";
import { daysToApril15 } from "./Home";

function Eyebrow({ extra }: { extra?: string }) {
  const { lang, L } = useUi();
  return <p className="eyebrow">{L.staff_h}{lang === "es" ? ` · ${L.staff_only}` : ""}{extra ? ` · ${extra}` : ""}</p>;
}

function StaffNav() {
  const { L } = useUi();
  return (
    <nav className="staffnav" aria-label="Staff pages">
      <span className="muted">{L.staff_h}:</span>
      <NavLink to="/data">Closed zones data</NavLink>
      <NavLink to="/corridors">Corridors</NavLink>
      <NavLink to="/april15">Before April 15</NavLink>
    </nav>
  );
}

const Arrow = ({ a, b, label }: { a: number; b: number; label?: string }) => (
  <td className="pct num" data-label={label ?? ""}>
    <span className="was">{Math.round(a)}%</span> → <b>{Math.round(b)}%</b><i className="dbar" style={{ ["--v" as string]: Math.round(b) }} />
  </td>
);

export function Data() {
  const d = useData();
  const { L } = useUi();
  const phone = usePhone();
  const T = d.totals;
  const zs = closedZones(d);
  return (
    <section className="screen wide">
      <Back />
      <Eyebrow />
      <h1>Closed zones</h1>
      <p className="muted small">{T.points.toLocaleString()} grid points, {T.spacingM} m apart. Straight lines to old and new school.</p>
      <dl className="facts three">
        <div><dt>{Math.round(T.pctOver2New * 10) / 10}%</dt><dd>2+ mi from school</dd></div>
        <div><dt>{Math.round(T.hazardNew.combined)}%</dt><dd>cross a dangerous road or rail (was {Math.round(T.hazardOld.combined)}%)</dd></div>
        <div><dt>{Math.round(T.hazardNew.rail)}%</dt><dd>cross rail (was {Math.round(T.hazardOld.rail)}%)</dd></div>
      </dl>
      <WcMap kind="zones" height={phone ? 340 : 460} />
      <p className="small muted">Fill: share crossing a hazard. Dot: pickup. Square: new school.</p>
      <h2>Per closed zone</h2>
      <p className="muted small">{L.pct_note}</p>
      <table className="tbl fit stack">
        <thead>
          <tr>
            <th>Closed zone</th><th className="num">Median walk</th><th className="num">Farther</th><th className="num">2+ mi</th>
            <th className="num">Ped-dangerous road</th><th className="num">High-injury road</th><th className="num">Active railroad</th><th className="num">Either hazard</th>
          </tr>
        </thead>
        <tbody>
          {zs.map((z) => (
            <tr key={z.nbr}>
              <td className="name">
                <Link to={`/zone/${z.nbr}`}>{z.name}</Link><br />
                <span className="muted small">→ {z.receiving.map((r) => r.name + (r.share < 100 ? ` (${Math.round(r.share)}%)` : "")).join(", ")}</span>
              </td>
              <td className="num" data-label="Median walk">{mi(z.medOldM)} → {mi(z.medNewM)} mi</td>
              <td className="num" data-label="Farther">{Math.round(z.pctFarther)}%</td>
              <td className="num" data-label="2+ mi">{z.pctOver2New}%</td>
              <Arrow a={z.hazOld.ped} b={z.hazNew.ped} label="Ped-dangerous road" />
              <Arrow a={z.hazOld.hin} b={z.hazNew.hin} label="High-injury road" />
              <Arrow a={z.hazOld.rail} b={z.hazNew.rail} label="Active railroad" />
              <Arrow a={z.hazOld.combined} b={z.hazNew.combined} label="Either hazard" />
            </tr>
          ))}
          <tr className="total">
            <td className="name">All seven</td><td data-label="Median walk" /><td data-label="Farther" />
            <td className="num" data-label="2+ mi">{Math.round(T.pctOver2New * 10) / 10}%</td>
            <Arrow a={T.hazardOld.ped} b={T.hazardNew.ped} label="Ped-dangerous road" />
            <Arrow a={T.hazardOld.hin} b={T.hazardNew.hin} label="High-injury road" />
            <Arrow a={T.hazardOld.rail} b={T.hazardNew.rail} label="Active railroad" />
            <Arrow a={T.hazardOld.combined} b={T.hazardNew.combined} label="Either hazard" />
          </tr>
        </tbody>
      </table>
      <h2>The seven pickups</h2>
      <p>Shuttle to the new school, 2026–27 and 2027–28, any K–12 student. <a href={HISD_FAQ} target="_blank" rel="noopener">HISD FAQ</a></p>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Pickup</th><th>To</th><th>Shuttle</th><th>Walk to the pickup crosses a hazard</th><th>Roads crossed most</th></tr></thead>
          <tbody>
            {zs.map((z) => (
              <tr key={z.nbr}>
                <td><b>{z.name}</b><br /><span className="muted">{z.address}</span></td>
                <td>{z.receiving.map((r) => r.name).join(", ")}</td>
                <td>{z.shuttleMi} mi, through 2027–28</td>
                <td>{Math.round(z.hazOld.combined)}% of the zone; {Math.round(z.hazOld.rail)}% crosses track</td>
                <td>{z.pickupRoads.map((p) => `${p.name} (${Math.round(p.share)}%)`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p><b>Not public:</b> stop location and times (HISD), campus school zone hours (HPW), crossing guards (HISD).</p>
      <p className="small muted">{L.pct_note} {L.note_lines}</p>
      <StaffNav />
    </section>
  );
}

const rank = (c: CorridorStat) => {
  const k = c.control;
  return !k?.crossings ? 3 : k.within500Pct === 0 ? 0 : k.within250Pct < 50 ? 1 : 2;
};

export function Corridors() {
  const d = useData();
  const { L } = useUi();
  const rows = d.corridors.filter((c) => c.pointsNewlyCrossed > 0).sort((a, b) => rank(a) - rank(b) || b.pointsNewlyCrossed - a.pointsNewlyCrossed);
  const maxPts = Math.max(...rows.map((c) => c.pointsNewlyCrossed));
  const ctrl = (c: CorridorStat) => {
    const k = c.control;
    if (!k?.crossings) return <>—</>;
    if (k.within250Pct === 0 && k.within500Pct === 0) return <><b>No</b> {c.kind === "rail" ? "public rail crossing" : "traffic light"} within 0.3 mi of where the walks cross.</>;
    const p = k.within250Pct;
    const med = k.medianM === null ? "n/a" : k.medianM >= 800 ? `${mi(k.medianM)} mi` : `${ft(k.medianM)} ft`;
    return <><b>{p >= 50 ? "Yes" : "Mostly no"}</b> {Math.round(p)}% of crossings have one within 800 ft; median {med}.{k.nearest ? ` Nearest: ${k.nearest}.` : ""}</>;
  };
  const can = (c: CorridorStat) => {
    if (c.kind === "rail")
      return <><b>HISD:</b> a bus stop on the home side of the tracks.<br /><b>City:</b> a sidewalk to, and a guard at, the nearest public crossing{c.control?.nearest ? ` (${c.control.nearest})` : ""}.</>;
    const sc = c.streetClass;
    const cityOwned = !sc?.owner || sc.owner === "COH";
    const onPath = cityOwned && (!!sc?.thoroughfareOrCollector || (c.bordersSchool ?? []).length > 0);
    const zone = onPath ? `School zone: principal of ${(c.bordersSchool ?? [])[0] ?? c.receiving[0] ?? "the receiving school"} applies by April 15` : "No school zone on paper (local street)*";
    return <>Crossing guard**<br />{zone}<br />Crosswalk or signal study: 311</>;
  };
  return (
    <section className="screen wide">
      <Back />
      <Eyebrow />
      <h1>Corridors</h1>
      <p className="muted small">Roads and rail the new walks cross. No light first.</p>
      <StaffAsk
        suggestions={[
          "Which corridors have no traffic light nearby, and which receiving schools' walks cross them?",
          "Which of these streets could get a City school zone under HPW's written rules?",
          "Where do the new walks cross active rail with no public crossing close by?",
        ]}
        pick={rowPicker(new Set(rows.map((c) => c.key)))}
      />
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr><th>Road or track</th><th>Traffic light or public crossing nearby?</th><th>What can change it</th><th className="num">Area newly crossing</th><th>Closed zone</th><th className="num">Ped. crashes / deaths</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} data-row={c.key}>
                <td><b>{c.name}</b><br /><span className="muted small">{c.kind === "rail" ? "Railroad" : [c.pedDangerous && "Ped-dangerous", c.highInjury && "High-injury"].filter(Boolean).join(", ")}</span></td>
                <td>{ctrl(c)}</td>
                <td>{can(c)}</td>
                <td className="pct num">
                  {((100 * c.pointsNewlyCrossed) / d.totals.points).toFixed(1)}% <span className="muted small">({c.pointsNewlyCrossed} pts)</span>
                  <i className="dbar" style={{ ["--v" as string]: Math.round((100 * c.pointsNewlyCrossed) / maxPts) }} />
                  {c.pointsOldRoute > 0 && <span className="muted small">+{c.pointsOldRoute} on both walks</span>}
                </td>
                <td>{c.zones.map(short).join(", ")}</td>
                <td className="num">{c.kind === "rail" ? "n/a" : `${c.pedCrashes} / ${c.pedDeaths}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">* School zone: borders the school, or City thoroughfare/collector. ** Guards: City decides (Tex. Local Gov’t Code §343.014). Crashes: HIN 2022. Lights: TranStar. {L.pct_note}</p>
      <StaffNav />
    </section>
  );
}

const pathOf = (s: StreetRequest) => (s.path === "borders" ? "Borders the school" : s.path === "thoroughfare-collector" ? "Thoroughfare or collector" : "Neither, on paper");
const lights = (s: StreetRequest) => (s.lights.within500 ? `${s.lights.within500} within 500 m · median ${s.lights.medianM} m away` : "None within 500 m");
const cls = (s: StreetRequest) => (s.streetClass?.type ? `${s.streetClass.type} · ${s.streetClass.owner ?? ""}` : "Local street (not on the thoroughfare plan)");

export function April15() {
  const d = useData();
  const Z = d.zoneRequests;
  const [days, yr] = daysToApril15();
  const ids = new Set(Z.schools.flatMap((s) => s.streets.map((st) => st.id)));
  return (
    <section className="screen wide">
      <Back />
      <Eyebrow extra={`${days} days until April 15, ${yr}`} />
      <h1>Before April 15</h1>
      <p className="muted small">School zone applications for each new school. Principal reviews, counts, signs.</p>
      <ol className="timeline">
        <li><b>Feb 26, 2026</b> HISD’s board approves the closures.</li>
        <li><b>Apr 15, 2026</b> School-zone applications close, 48 days later. Nobody walks the new routes yet.</li>
        <li><b>Aug 2026</b> New walks begin. HISD’s shuttle runs from each old campus.</li>
        <li><b>Apr 15, 2027</b> Deadline for 2027–28, the shuttle’s last year. Council updates the ordinance in July; signs follow.</li>
        <li><b>End of 2027–28</b> The shuttle ends. The 2-mile bus rule applies again.</li>
        <li><b>Apr 15, 2028</b> Deadline for 2028–29, the first year without the shuttle.</li>
      </ol>
      <p className="muted small">2023 batch: ~11 months to signs. Apply April 2027 to beat the shuttle’s end.</p>
      <StaffAsk
        suggestions={[
          "Which receiving schools have a street on a written path to a school zone, and which streets?",
          "Which streets are on neither path, and what can the school ask for there instead?",
          "Which school's new walkers cross the most streets with no traffic light within 500 m?",
        ]}
        pick={rowPicker(ids)}
      />
      <h2>Streets by school</h2>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Street</th><th className="num">Newly crossing</th><th className="num">Ped. crashes / deaths</th><th>Traffic lights</th><th>City street class</th><th>HPW’s written path</th></tr></thead>
          <tbody>
            {Z.schools.map((s) => [
              <tr key={s.nbr} className="group">
                <td colSpan={6}>
                  <b>{s.name}</b> takes {Math.round(s.shareOfZone)}% of the old {s.zone} zone
                  {s.streets.length ? "" : " · no City high-injury street is newly crossed"}
                  {s.railNewlyPct ? ` · ${Math.round(s.railNewlyPct)}% newly crosses active railroad; a school zone does not cover that` : ""}
                </td>
              </tr>,
              ...s.streets.map((st) => (
                <tr key={st.id} data-row={st.id} className={st.path === "neither" ? "no" : ""}>
                  <td>{st.name}</td>
                  <td className="pct num">{st.share.toFixed(1)}%<i className="dbar" style={{ ["--v" as string]: Math.round(st.share) }} /></td>
                  <td className="num">{st.pedCrashes} / {st.pedDeaths}</td>
                  <td>{lights(st)}</td>
                  <td>{cls(st)}{st.streetClass?.owner && st.streetClass.owner !== "COH" && <><br /><span className="muted small">HPW’s form asks for a City street</span></>}</td>
                  <td>{pathOf(st)}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <h2>Draft applications</h2>
      <p className="muted small">Principal adds contacts, bell times, count, signature.</p>
      <ul className="plain drafts">
        {Z.schools.map((s) => {
          const ok = s.streets.filter((st) => st.path !== "neither").length, alt = s.streets.length - ok;
          return (
            <li key={s.nbr}>
              <Link to={`/draft/${s.nbr}`}><b>{s.name}</b></Link>{" "}
              <span className="muted">· {ok} requested street{ok === 1 ? "" : "s"}{alt ? `, ${alt} for a crosswalk or guard instead` : ""}</span>
            </li>
          );
        })}
      </ul>
      <h2>The seven pickups</h2>
      <p>Closed campuses have no principal to renew their school zones. Unresolved for 2027–28. <Link to="/data">Pickups ›</Link></p>
      <StaffNav />
    </section>
  );
}

export function Draft() {
  const d = useData();
  const { L } = useUi();
  const { nbr } = useParams();
  const s = d.zoneRequests.schools.find((x) => String(x.nbr) === nbr);
  if (!s) return <April15 />;
  const z = closedZones(d).find((c) => c.name === s.zone);
  const doc = (
    <ZoneDoc
      school={s.name}
      address={s.address}
      zoneName={s.zone}
      before={z?.hazOld.combined ?? 0}
      now={z?.hazNew.combined ?? 0}
      count
      streets={s.streets.map((st) => ({
        name: st.name, pc: st.pedCrashes, pd: st.pedDeaths,
        toc: !!st.streetClass?.thoroughfareOrCollector, borders: st.borders, owner: st.streetClass?.owner, share: st.share,
      }))}
    />
  );
  return (
    <section className="screen has-bar">
      <PrintDoc>{doc}</PrintDoc>
      <Back />
      <Eyebrow />
      <h1>Draft school zone application: {s.name}</h1>
      <div className="cols">
        <div className="col">
          <p className="muted small">New streets, by HPW’s written path.</p>
          <dl className="def">
            <dt>Principal</dt><dd>{L.front}<br />{s.name} · {s.address}</dd>
            <dt>Send to</dt><dd>Houston Public Works, School Coordination Program<br /><a href={`mailto:${HPW_EMAIL}`}>{HPW_EMAIL}</a></dd>
          </dl>
          <NarrativeDraft nbr={s.nbr} />
        </div>
        <div className="col side">
          <Paper pages={L.page1}>{doc}</Paper>
          <ActionBar btns={[{ label: L.print_req, primary: true, onClick: () => window.print() }]} />
        </div>
      </div>
    </section>
  );
}
