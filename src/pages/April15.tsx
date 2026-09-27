import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, Marker, Tooltip } from "react-leaflet";
import { Link, useParams } from "react-router-dom";
import { type ReceivingSchoolRequests, type StreetRequest, type ZonePath, segmentFeatures, useData } from "../lib/data";
import { type LngLat } from "../lib/geo";
import { dist, pct } from "../lib/format";
import { COLORS, FitTo, MapBase, MapLegend, pinIcon } from "../components/MapBase";
import "../april15.css";
import { Caveats, DataVintage } from "../components/Notes";
import { NarrativeDraft, StaffAsk } from "../components/StaffAsk";

// The City's School Coordination Program (HPW application, effective Sept 1, 2023; read 2026-09-26). Quoted, not
// paraphrased, where the page leans on it. Rows in ../../VERIFY.md.
const HPW_FORM = "https://www.houstonpublicworks.org/sites/g/files/nwywnm456/files/doc/school_zone_application_08-2023.pdf";
const HPW_CONTACT = "msdsupport@houstontx.gov · P.O. Box 1562, Houston, Texas 77251-1562";

const PATH_LABEL: Record<ZonePath, string> = {
  borders: "Borders the school",
  "thoroughfare-collector": "Thoroughfare or collector",
  neither: "Neither, on paper",
};
const ll = ([x, y]: LngLat) => [y, x] as [number, number];
const hasPath = (r: StreetRequest) => r.path !== "neither";
const nonCity = (r: StreetRequest) => !!r.streetClass?.owner && r.streetClass.owner !== "COH";
const title = (school: string) => school.replace(/ ES$/, " Elementary School");

/** The next April 15 from today, and the days until it. */
export function nextDeadline(now = new Date()) {
  let y = Math.max(2027, now.getFullYear());
  let d = new Date(y, 3, 15);
  if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) d = new Date(++y, 3, 15);
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  return { year: y, days };
}

function StreetClass({ r }: { r: StreetRequest }) {
  const c = r.streetClass;
  if (!c) return <span className="muted">not checked</span>;
  if (!c.type) return <>Local street <span className="muted small">(not on the Major Thoroughfare Plan)</span></>;
  return <>{c.type}{c.owner && <span className={nonCity(r) ? "owner-flag" : "muted small"}> · {c.owner === "COH" ? "City" : c.owner}</span>}</>;
}

function Lights({ r }: { r: StreetRequest }) {
  if (r.lights.within500 === 0) return <span className="chip-none">None within 500 m</span>;
  return <>{r.lights.within500} within 500 m{r.lights.medianM !== null && <span className="muted small"> · median {r.lights.medianM} m away</span>}</>;
}

export default function April15() {
  const d = useData();
  const { schools, minPoints } = d.zoneRequests;
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [printing, setPrinting] = useState<number | null>(null);
  const deadline = nextDeadline();

  const rows = useMemo(() => schools.flatMap((s) => s.streets.map((r) => ({ s, r }))), [schools]);
  const selected = rows.find((x) => x.r.id === sel) ?? null;
  const noLight = rows.filter(({ r }) => r.lights.within500 === 0);

  // Print one draft: open it, mark it, print, then put the page back.
  useEffect(() => {
    if (printing === null) return;
    document.body.classList.add("print-draft");
    const done = () => { document.body.classList.remove("print-draft"); setPrinting(null); };
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); document.body.classList.remove("print-draft"); };
  }, [printing]);
  const printDraft = (nbr: number) => { setOpen((o) => new Set(o).add(nbr)); setPrinting(nbr); };

  const fit: LngLat[] = selected
    ? [...selected.r.at, selected.s.loc, ...[selected.r.limits?.fromLoc, selected.r.limits?.toLoc].filter((p): p is LngLat => !!p)]
    : [...rows.flatMap(({ r }) => r.at), ...schools.map((s) => s.loc)];

  return (
    <div className="page april15">
      <p className="deadline no-print"><strong>{deadline.days} days</strong> until April 15, {deadline.year}</p>
      <h1>Before April 15: school zones for the new walks</h1>
      <p className="lede">
        The City's school-zone process was built for schools that stay put. A school's principal applies by April 15, and
        on a street that doesn't border the school HPW asks for "observation or evidence of students walking." The 2026
        deadline came before anyone walked the new routes. By April 15, 2027 they'll have been walked for eight months, but
        only by families who skip HISD's shuttle, which still runs from each old campus. A count this year shows fewer walkers
        than fall 2028 will, when the shuttle is gone. This page does the homework for each receiving school: the streets its
        new walkers cross, what the City's own layers say about each one, and a filled-in draft of HPW's application, with a
        line for the school's own count, for the principal to review and sign. That's one application per school, through the
        normal channel.
      </p>

      <ol className="timeline" aria-label="Dates">
        <li><span className="when">Feb 26, 2026</span> HISD's board approves the closures.</li>
        <li><span className="when">Apr 15, 2026</span> School-zone applications close, 48 days later. Nobody walks the new routes yet.</li>
        <li><span className="when">Aug 2026</span> New walks begin. HISD's shuttle runs from each old campus.</li>
        <li className="key"><span className="when">Apr 15, 2027</span> Deadline for 2027–28, the shuttle's last year. Council updates the ordinance in July; signs follow.</li>
        <li><span className="when">End of 2027–28</span> The shuttle ends. The 2-mile bus rule applies again.</li>
        <li className="key"><span className="when">Apr 15, 2028</span> Deadline for 2028–29, the first year without the shuttle.</li>
      </ol>
      <p className="small muted">
        Signing the City's 2023 batch of 38 schools took about 11 months (City Council committee slides, Sept 2023). An application
        in April 2027 is the one that can have signs up before the shuttle ends.
      </p>

      <StaffAsk
        suggestions={[
          "Which receiving schools have a street on a written path to a school zone, and which streets?",
          "Which streets are on neither path, and what can the school ask for there instead?",
          "Which school's new walkers cross the most streets with no traffic light within 500 m?",
        ]}
        pick={(id) => {
          if (!rows.some(({ r }) => r.id === id)) return null;
          return () => setSel(id);
        }}
      />

      <h2>The streets, by receiving school</h2>
      <p>
        Each row is a street that a straight-line walk to the school crosses, when the walk to the old campus didn't. It shows the
        City's crash counts on the crossed segments, the nearest traffic lights, and the City's class for the street. HPW considers a zone on a street that "borders
        the school," or on one that "does not border the school but is a thoroughfare or collector," and "the street must be
        owned by the City of Houston." HPW decides after its own study. This page only sorts the streets by which written path
        they could use.
      </p>

      <div className="split corridor-split">
        <div className="table-scroll">
          <table className="data selectable">
            <thead>
              <tr>
                <th>Street</th><th>Newly crossing*</th><th>Ped. crashes / deaths</th><th>Traffic lights</th><th>City street class</th><th>HPW's written path</th>
              </tr>
            </thead>
            {schools.filter((s) => s.streets.length).map((s) => (
              <tbody key={s.nbr}>
                <tr className="group"><th colSpan={6} scope="colgroup">{s.name} <span className="muted small">takes {pct(s.shareOfZone)} of the old {s.zone} zone</span></th></tr>
                {s.streets.map((r) => (
                  <tr key={r.id} className={r.id === sel ? "selected" : ""} tabIndex={0}
                    onClick={() => setSel(r.id === sel ? null : r.id)} onKeyDown={(e) => e.key === "Enter" && setSel(r.id === sel ? null : r.id)}>
                    <th scope="row">{r.name}</th>
                    <td>{pct(r.share)}</td>
                    <td>{r.pedCrashes} / {r.pedDeaths}</td>
                    <td><Lights r={r} /></td>
                    <td><StreetClass r={r} /></td>
                    <td>
                      <span className={`path path-${r.path}`}>{PATH_LABEL[r.path]}</span>
                      {r.path === "borders" && s.grounds === "point" && <span className="muted small"> (approx.)</span>}
                      {nonCity(r) && <div className="small owner-flag">Owned by {r.streetClass!.owner}; HPW's form asks for a City street</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          <p className="small muted">
            * Share of the area now zoned to that school (from the old zone) whose straight-line walk crosses the street when the walk
            to the old campus didn't. Streets under {minPoints} sample points are listed under each draft. Crashes: City High Injury
            Network 2022, on the crossed segments. Lights: traffic signals on that street (Houston TranStar's public list) within
            500 m of where the walks cross. Select a row to show it on the map.
          </p>
          {schools.some((s) => !s.streets.length) && (
            <p className="small">
              {schools.filter((s) => !s.streets.length).map((s) => s.name).join(", ")}: no City high-injury street is newly crossed.
              {schools.filter((s) => !s.streets.length && s.railNewlyPct > 0).map((s) => ` ${pct(s.railNewlyPct)} of the area now zoned to ${s.name} newly crosses active railroad; a school zone doesn't cover that.`).join("")}{" "}
              <Link to="/corridors">Corridors</Link> lists the rail crossings.
            </p>
          )}
        </div>
        <div className="mapwrap">
          <MapBase className="map">
            {rows.map(({ r }) => (
              <GeoJSON key={r.id + (r.id === sel)} data={{ type: "FeatureCollection", features: segmentFeatures(d, r.segments) } as any}
                style={{ color: r.path === "neither" ? COLORS.ped : COLORS.newRoute, weight: r.id === sel ? 8 : 4, opacity: sel && r.id !== sel ? 0.35 : 0.85 }}
                eventHandlers={{ click: () => setSel(r.id) }}>
                <Tooltip sticky>{r.name}: {PATH_LABEL[r.path].toLowerCase()}</Tooltip>
              </GeoJSON>
            ))}
            {selected && selected.r.at.map((p, i) => (
              <CircleMarker key={i} center={ll(p)} radius={3} pathOptions={{ color: "#111", weight: 1, fillColor: "#fff", fillOpacity: 1 }} interactive={false} />
            ))}
            {selected && [selected.r.limits?.fromLoc, selected.r.limits?.toLoc].map((p, i) => p && (
              <CircleMarker key={`lim${i}`} center={ll(p)} radius={7} pathOptions={{ color: "#111", weight: 2, fillColor: "#facc15", fillOpacity: 1 }}>
                <Tooltip>{i === 0 ? "From" : "To"}: {i === 0 ? selected.r.limits!.from : selected.r.limits!.to}</Tooltip>
              </CircleMarker>
            ))}
            {schools.map((s) => (
              <Marker key={s.nbr} position={ll(s.loc)} icon={pinIcon("S", "pin-new")}>
                <Tooltip>{s.name}, {s.address}</Tooltip>
              </Marker>
            ))}
            <FitTo points={fit} maxZoom={16} />
          </MapBase>
          <p className="small muted">
            Blue: a street with a written path. Red: neither, on paper. S: receiving school. With a row selected, white dots mark where
            the walks cross, and yellow dots mark the From and To cross streets.
          </p>
          <MapLegend />
        </div>
      </div>

      {noLight.length > 0 && (
        <p className="note">
          <strong>No traffic light within 500 m:</strong> {noLight.map(({ r, s }) => `${r.name} (${s.name})`).join(", ")}.{" "}
          {noLight.every(({ r }) => r.path === "neither")
            ? "Each is a local street that doesn't border its school, so HPW's written criteria don't cover a school zone there. The same application has a crosswalk page, and the City decides how many crossing guards are needed. Each draft below says so."
            : "Each draft below says which path, if any, applies."}
        </p>
      )}

      <h2>Draft applications</h2>
      <p>
        One per receiving school, in the order of <a href={HPW_FORM} target="_blank" rel="noreferrer">HPW's application form</a>. The
        principal fills in the contact lines, bell times and signature. Everything else comes from public data and is marked as such.
      </p>
      <div className="drafts">
        {schools.map((s) => (
          <details key={s.nbr} id={`draft-${s.nbr}`} className={`draft-app${printing === s.nbr ? " print-target" : ""}`} open={open.has(s.nbr)}
            onToggle={(e) => { const isOpen = (e.currentTarget as HTMLDetailsElement).open; setOpen((o) => { const n = new Set(o); if (isOpen) n.add(s.nbr); else n.delete(s.nbr); return n; }); }}>
            <summary>
              <strong>{s.name}</strong>{" "}<Link className="small no-print" to={`/april-15/${s.nbr}`}>(own page)</Link>{" "}
              <span className="muted small">
                {s.streets.filter(hasPath).length} requested street{s.streets.filter(hasPath).length === 1 ? "" : "s"}
                {s.streets.some((r) => !hasPath(r)) ? `, ${s.streets.filter((r) => !hasPath(r)).length} for a crosswalk or guard instead` : ""}
              </span>
            </summary>
            <Draft s={s} minPoints={minPoints} onPrint={() => printDraft(s.nbr)} />
          </details>
        ))}
      </div>

      <h2>The seven pickups</h2>
      <p>
        The other half of the handoff. A school zone's hours follow its school's bell, and only its principal can ask to change it. The
        seven closed campuses have no principal, and the shuttle there runs on the receiving school's clock. Whether each old zone is
        still in the ordinance, and on what hours, isn't public. Someone has to decide what those zones do in 2027–28, by the same
        April 15. <Link to="/zones" state={{ scrollTo: "pickups" }}>See the pickup cards</Link>.
      </p>

      <Caveats area />
      <DataVintage />
    </div>
  );
}

/** One school's draft on its own page, for the family's school-zone screen to link to and for printing alone. */
export function DraftPage() {
  const { schools, minPoints } = useData().zoneRequests;
  const { nbr } = useParams();
  const s = schools.find((x) => String(x.nbr) === nbr);
  if (!s) return <April15 />;
  return (
    <div className="page april15 draft-page">
      <p className="no-print"><Link to="/april-15">‹ Before April 15: every receiving school</Link></p>
      <h1 className="no-print">Draft school zone application: {s.name}</h1>
      <p className="lede no-print">
        Streets a newly zoned walk crosses, sorted by HPW's written paths. Public data fills it in; the principal adds the contact
        lines, bell times, the school's own count and the signature, then sends it to Houston Public Works by April 15.
      </p>
      <NarrativeDraft nbr={s.nbr} />
      <Draft s={s} minPoints={minPoints} onPrint={() => window.print()} />
    </div>
  );
}

/** Blank line for the principal to fill in. */
const Blank = ({ note = "school fills in" }: { note?: string }) => <span className="blank">{note}</span>;

function Draft({ s, minPoints, onPrint }: { s: ReceivingSchoolRequests; minPoints: number; onPrint: () => void }) {
  const requested = s.streets.filter(hasPath);
  const other = s.streets.filter((r) => !hasPath(r));
  const zone = s.zone.replace(/ ES$/, "");
  return (
    <div className="draft-body">
      <div className="draft-actions no-print">
        <button type="button" className="button" onClick={onPrint}>Print this draft</button>
      </div>
      <p className="draft-stamp">DRAFT: prepared from public data for the principal to review. Not submitted.</p>
      <h3>School Zone: Coordination Program application</h3>
      <p className="small">Houston Public Works · {HPW_CONTACT} · Application deadline April 15</p>

      <h4>Contact information</h4>
      <dl className="form-grid">
        <dt>Name of School</dt><dd>{title(s.name)}</dd>
        <dt>School District</dt><dd>Houston ISD</dd>
        <dt>Contact Phone #</dt><dd><Blank /></dd>
        <dt>Requestor Name</dt><dd><Blank note="the principal" /></dd>
        <dt>Designated Appointee</dt><dd><Blank /></dd>
        <dt>Email Address</dt><dd><Blank /></dd>
        <dt>Address</dt><dd>{s.address}</dd>
        <dt>Zip Code</dt><dd>{s.zip ?? <Blank />}</dd>
      </dl>
      <h4>Student hours</h4>
      <dl className="form-grid">
        <dt>Intake time(s)</dt><dd><Blank note="school's bell times" /></dd>
        <dt>Dismissal time(s)</dt><dd><Blank note="school's bell times" /></dd>
        <dt>Late intake / day(s)</dt><dd><Blank /></dd>
        <dt>Early dismissal / day(s)</dt><dd><Blank /></dd>
        <dt>Requestor Signature / Date</dt><dd><Blank note="principal signs" /></dd>
      </dl>
      <h4>Type of installation</h4>
      <ul className="checks">
        <li><span aria-hidden>{requested.length ? "☒" : "☐"}</span> Installation of a new School Zone</li>
        <li><span aria-hidden>☐</span> Removal of existing School Zone</li>
        <li><span aria-hidden>☐</span> Parking Restrictions/Bus Zone</li>
        <li><span aria-hidden>☐</span> Installation of Crosswalk{other.length ? " (see the last section: the principal decides)" : ""}</li>
      </ul>

      <h4>Requested street: school zone</h4>
      {requested.length ? (
        <table className="data form-table">
          <thead><tr><th>Requested Street</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {requested.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.limits?.from ?? <Blank note="HPW sets" />}</td>
                <td>{r.limits?.to ?? <Blank note="HPW sets" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No street here fits one of HPW's written paths. See the last section.</p>
      )}
      <p className="small muted">From and To are the cross streets just outside where the walks cross, from the City's road centerline. HPW sets the final limits.</p>

      <section className="draft-attachment">
        <h4>Attachment: why these streets</h4>
        <p>
          The {zone} Elementary zone closed after 2025–26. Since August 2026, {pct(s.shareOfZone)} of its area is zoned to {title(s.name)}.
          HISD's shuttle runs from the old {zone} campus through the 2027–28 school year, so the students walking these streets now are the
          ones who skip it. From fall 2028, with no shuttle, every student from that area who walks to school crosses them. Today's count
          is a floor.
        </p>
        {requested.some((r) => r.path === "thoroughfare-collector") && (
          <p>
            <strong>Observed:</strong> <Blank note="number" /> students walking or biking across{" "}
            {requested.filter((r) => r.path === "thoroughfare-collector").map((r) => r.name).join(", ")}, on <Blank note="date" />,{" "}
            <Blank note="times" />.{" "}
            <span className="small muted">
              HPW asks for "observation or evidence of students walking or riding bicycles" on a street that doesn't border the
              school. A staff count at intake and dismissal is one way to show it.
            </span>
          </p>
        )}
        <ul>
          {s.streets.map((r) => (
            <li key={r.id}>
              <strong>{r.name}.</strong> {pct(r.share)} of that area crosses it on a straight-line walk to school; none of it did on the walk
              to the old campus. {r.pedCrashes || r.pedDeaths ? `${r.pedCrashes} pedestrian crash${r.pedCrashes === 1 ? "" : "es"} and ${r.pedDeaths} death${r.pedDeaths === 1 ? "" : "s"} on the crossed segments (City High Injury Network 2022). ` : "On the City's High Injury Network (2022). "}
              {r.lights.within500 === 0 ? "No traffic light on it within 500 m of where the walks cross. " : `Nearest light: ${r.lights.nearest ?? "on the street"}, a median ${r.lights.medianM} m from the crossing. `}
              {r.streetClass?.type ? `${r.streetClass.type} on the City's Major Thoroughfare and Freeway Plan${r.streetClass.owner ? `, owned by ${r.streetClass.owner === "COH" ? "the City" : r.streetClass.owner}` : ""}. ` : "A local street, not on the Major Thoroughfare and Freeway Plan. "}
              {r.borders ? `It borders the school${s.grounds === "point" ? " (judged from the campus point, approximately)" : ""}. ` : ""}
              The walks cross it a median {dist(r.medianToSchoolM, "en")} from the school.
            </li>
          ))}
        </ul>
        {s.smaller.length > 0 && (
          <p className="small">Also newly crossed, by fewer than {minPoints} sample points: {s.smaller.map((x) => x.name).join(", ")}.</p>
        )}
        <p className="small muted">
          Method: a ~110 m grid over the old zone; each point's straight line to the old campus and to this school, tested against the
          City's High Injury Network and pedestrian-dangerous roads (2022). Shares are of land area, not of students; real walks follow
          streets. Sources: HISD boundaries and campuses 2025–26 and 2026–27; City of Houston Vision Zero layers; Houston TranStar signal
          list; City Major Thoroughfare and Freeway Plan; City road centerline.
        </p>
      </section>

      {other.length > 0 && (
        <section className="draft-other">
          <h4>Streets that don't fit HPW's written paths</h4>
          <ul>
            {other.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>: {r.streetClass?.type ? `a ${r.streetClass.type.toLowerCase()}` : "a local street"} that doesn't
                border the school{r.lights.within500 === 0 ? ", with no traffic light within 500 m of where the walks cross" : ""}.{" "}
                {pct(r.share)} of the area crosses it.
              </li>
            ))}
          </ul>
          <p>
            HPW's criteria for a zone away from the school name thoroughfares and collectors. The same application has a crosswalk page.
            Crosswalks go only where there are ADA-compliant ramps, and "a crossing-guard must be assigned at mid-block crossings serving
            elementary students." The City decides how many crossing guards are needed (Tex. Local Gov't Code §343.014). Ask HPW which fits
            these crossings.
          </p>
        </section>
      )}
    </div>
  );
}
