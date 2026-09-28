// The three documents Walk Check prints: the family's walk plan, the principal's bus request to HISD, and the City
// school-zone application. Letter size; shown scaled in <Paper> and printed from #print-root. The two requests are
// English because the school files them. Wording follows the copy rules: the page states conditions, HISD decides.
import { HPW_EMAIL, HISD_LINE } from "../../lib/ui/contacts";
import { type UiCrossing, type UiResult, crossList, crossingAdvice, ft, mi, short } from "../../lib/ui/model";
import { UI } from "../../lib/ui/strings";
import { useUi } from "./bits";

const todayIn = (lang: "en" | "es") => new Date().toLocaleDateString(lang === "es" ? "es-US" : "en-US", { year: "numeric", month: "long", day: "numeric" });

function Letterhead({ title, sub, to }: { title: string; sub: string; to?: string }) {
  return (
    <header className="doc-head">
      <div className="doc-brand"><svg width="22" height="22" className="on-green"><use href="#logo" /></svg><span>Walk Check</span></div>
      <div className="doc-meta">{to && <><b className="doc-to">{to}</b><br /></>}{title}<br />{sub}</div>
    </header>
  );
}
const Sigs = ({ a, b }: { a: string; b: string }) => (
  <div className="doc-sigs"><div><i /><span>{a}</span></div><div><i /><span>{b}</span></div></div>
);
const kindLabel = (c: UiCrossing) => (c.kind === "rail" ? "Active railroad" : c.ped ? "Pedestrian-dangerous road (Vision Zero 2022)" : "High Injury Network road (2022)");
const ctrlLabel = (c: UiCrossing) =>
  c.control.has ? `${c.control.kind === "xing" ? "Public crossing" : "Signal"}: ${c.control.name}, ${ft(c.control.d!)} ft ${c.control.dir}` : "None within 800 ft";

function CrossTable({ rows }: { rows: UiCrossing[] }) {
  return (
    <table className="doc-table">
      <thead><tr><th>#</th><th>Crossing</th><th>City record</th><th>Ped. crashes / deaths</th><th>Nearest control</th></tr></thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={c.key}><td>{i + 1}</td><td><b>{c.name}</b></td><td>{kindLabel(c)}</td><td>{c.kind === "rail" ? "n/a" : `${c.pc} / ${c.pd}`}</td><td>{ctrlLabel(c)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** The family's one-page walk plan, in their language. */
export function PlanDoc({ r, addr, dates }: { r: UiResult; addr: string; dates: { rail: string; signals: string } }) {
  const { lang, L } = useUi();
  const xb = r.before.length ? L.plan_xsome(crossList(r.before, lang)) : L.plan_xnone;
  return (
    <article className="doc doc-plan">
      <Letterhead title={L.plan_title} sub={todayIn(lang)} />
      <h1>{L.plan_to(r.recv.name)}</h1>
      <p className="doc-sub">{L.plan_for} {addr} · {r.recv.address}</p>
      <div className="doc-cmp">
        <div><small>{L.lastyear}: {short(r.closed.name)}</small><b>{mi(r.distBeforeM)} mi · {r.before.length ? L.doc_cross(r.before.length) : L.doc_none}</b></div>
        <div className="warm"><small>{L.now}: {short(r.recv.name)}</small><b>{mi(r.distNowM)} mi · {r.now.length ? L.doc_cross(r.now.length) : L.doc_none}</b></div>
      </div>
      <h2>{L.plan_order}</h2>
      <ol className="doc-list">
        {r.now.length ? (
          r.now.map((c) => (
            <li key={c.key}><span className={`mk ${c.kind}`} /><div><b>{c.kind === "rail" ? `${L.plan_tracks} · ${c.name}` : c.name}</b><span>{crossingAdvice(c, L)}</span></div></li>
          ))
        ) : (
          <li><span className="mk" /><div><b>{L.plan_nothing}</b><span>{L.plan_anyway}</span></div></li>
        )}
      </ol>
      <div className="doc-note" dangerouslySetInnerHTML={{ __html: L.plan_shuttle(esc(r.closed.name), esc(r.closed.address), mi(r.distBeforeM), esc(xb)) }} />
      <div className="doc-note outline" dangerouslySetInnerHTML={{ __html: L.plan_bring(esc(r.recv.name), esc(L.plan_principal), undefined) }} />
      <footer className="doc-foot"><span>{r.path ? L.plan_foot_route : L.plan_foot} {L.disc_short}</span><span>{L.plan_dates(dates.rail, dates.signals)}</span></footer>
    </article>
  );
}

/** The bus request the principal files with HISD Transportation. English: the school files it. */
export function BusDoc({ r, addr, walkway }: { r: UiResult; addr: string; walkway?: string | null }) {
  const rail = r.now.find((c) => c.kind === "rail");
  const what = [
    r.roads ? `${r.roads} road${r.roads > 1 ? "s" : ""} on the City of Houston's 2022 High Injury Network` : "",
    rail ? "active railroad track" : "",
  ].filter(Boolean).join(" and ");
  return (
    <article className="doc doc-hisd">
      <Letterhead title="Hazardous walking route · request for bus service" sub={todayIn("en")} to="To HISD Transportation" />
      <h1>Request: hazardous-route bus stop, former {r.closed.name} zone</h1>
      <p className="doc-sub">Prepared for the Principal, {r.recv.name} · To: HISD Transportation, Routing &amp; Scheduling</p>
      <dl className="doc-facts">
        <dt>Home area</dt><dd>{addr}</dd>
        <dt>Former campus</dt><dd>{r.closed.name}, {r.closed.address} (closed June 2026)</dd>
        <dt>Receiving campus</dt><dd>{r.recv.name}, {r.recv.address}</dd>
        <dt>Straight-line distance</dt><dd>{mi(r.lineNowM)} mi (inside the 2-mile rule; {r.closed.pctOver2New}% of the former zone is 2+ mi)</dd>
      </dl>
      <h2>Conditions on this walk</h2>
      <p>
        {what
          ? `The walk crosses conditions that Tex. Educ. Code §48.151 and HISD's hazardous-route definition describe: ${what}.`
          : "The walk to school crosses nothing on the City's lists; see the walk to the shuttle pickup below."}
        {rail ? " A news report on HISD's process (Houston Landing, December 2024) says a walk across active track counts as hazardous for elementary students. HISD decides." : ""}
      </p>
      {r.now.length > 0 && <CrossTable rows={r.now} />}
      {walkway && (
        <>
          <h2>Walkway conditions (family's description)</h2>
          <p>{walkway}</p>
        </>
      )}
      <h2>Proposed stop</h2>
      <p>
        Near {addr}{rail ? ", on the home side of the railroad, so students do not cross track to reach the bus" : ""}. Until 2027–28 the closure shuttle picks
        up at {r.closed.name}; that walk {r.before.length ? `crosses ${crossList(r.before, "en")}` : "crosses nothing on the City's lists"}.
      </p>
      <h2>Families on this street</h2>
      <div className="doc-lines"><i /><i /><i /></div>
      <Sigs a="Principal signature · date" b="Regional superintendent · date" />
      <footer className="doc-foot">
        <span>Re-request each school year. Closure shuttle ends after 2027–28. HISD closure family line: {HISD_LINE}.</span>
        <span>Sources: HISD 2026–27 boundaries; City of Houston Vision Zero HIN 2022; HISD rail layer; FRA crossings</span>
      </footer>
    </article>
  );
}

export interface ZoneStreet { name: string; pc: number; pd: number; toc: boolean; borders: boolean; owner?: string | null; share?: number; lightNote?: string }
export interface ZoneDocProps { school: string; address: string; zoneName: string; before: number; now: number; streets: ZoneStreet[]; count?: boolean }

/** The City school-zone application, in the order of HPW's form, for the principal to review and sign. */
export function ZoneDoc(z: ZoneDocProps) {
  const ok = z.streets.filter((s) => s.toc || s.borders), alt = z.streets.filter((s) => !(s.toc || s.borders));
  const withShare = z.streets[0]?.share != null;
  return (
    <article className="doc doc-city">
      <Letterhead title="School zone application" sub={todayIn("en")} to="To the City of Houston · Public Works" />
      <h1>School zone request: {z.school}</h1>
      <p className="doc-sub">Submitted by the Principal · School Coordination Program, {HPW_EMAIL} · Applications close April 15</p>
      <dl className="doc-facts">
        <dt>Campus</dt><dd>{z.school}, {z.address}</dd>
        <dt>Change</dt><dd>{z.zoneName} closed June 2026; its zone now walks to this campus</dd>
        <dt>Share of the former zone whose walk crosses a dangerous road or rail</dt><dd>{Math.round(z.now)}% now, {Math.round(z.before)}% before</dd>
        {z.count && <><dt>School's own count of walkers</dt><dd className="doc-blank">&nbsp;</dd></>}
      </dl>
      <h2>Streets requested</h2>
      {ok.length ? (
        <table className="doc-table">
          <thead><tr><th>#</th><th>Street</th><th>HPW written path</th><th>Ped. crashes / deaths (2022)</th><th>{withShare ? "Share of zone crossing it" : "Nearest signal"}</th></tr></thead>
          <tbody>
            {ok.map((s, i) => (
              <tr key={s.name}>
                <td>{i + 1}</td><td><b>{s.name}</b></td>
                <td>{s.borders ? "Borders the school" : "Thoroughfare or collector"}{s.owner && s.owner !== "COH" ? ` · owned by ${s.owner}` : ""}</td>
                <td>{s.pc} / {s.pd}</td><td>{s.share != null ? `${Math.round(s.share)}%` : s.lightNote ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{UI.en.streets_none}</p>
      )}
      {alt.length > 0 && (
        <>
          <h2>Streets with no written path to a zone (local streets)</h2>
          <p>{alt.map((s) => s.name).join(", ")}: requested instead as a crossing guard post and a marked crosswalk, under the same application's crosswalk page.</p>
        </>
      )}
      <h2>Basis</h2>
      <p>
        Students from the former {z.zoneName} zone now walk to this campus and cross the streets above. Each requested street is on the City's 2022 High
        Injury Network. HPW considers a zone on a street that borders the school, or one that is a thoroughfare or collector and is owned by the City of Houston.
      </p>
      <h2>Requested</h2>
      <p>20 mph school zone with flashing beacons on the streets above, timed to arrival and dismissal, for the 2027–28 school year, the closure shuttle's last.</p>
      <Sigs a="Principal signature · date" b="Public Works use" />
      <footer className="doc-foot">
        <span>Prepared with Walk Check from public data. The school fills in bell times, contacts and its own count.</span>
        <span>Sources: City of Houston Vision Zero HIN 2022; MTFP; HISD 2026–27 boundaries</span>
      </footer>
    </article>
  );
}

/** The school-zone document for a family's walk: the receiving school, the roads on this walk. */
export function zoneDocFromWalk(r: UiResult): ZoneDocProps {
  return {
    school: r.recv.name,
    address: r.recv.address,
    zoneName: r.closed.name,
    before: r.closed.hazOld.combined,
    now: r.closed.hazNew.combined,
    streets: r.now.filter((c) => c.kind === "road").map((c) => ({
      name: c.name, pc: c.pc, pd: c.pd,
      toc: !!c.street?.toc, borders: !!c.street?.borders.includes(r.recv.name), owner: c.street?.owner,
      lightNote: ctrlLabel(c),
    })),
  };
}

/** Escape text going into the few strings that carry <b> markup. */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
