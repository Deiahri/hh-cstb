import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { METERS_PER_MILE } from "../lib/geo";
import { shareUrl, useT } from "../lib/i18n";
import { walkQuery } from "../lib/walk";
import { Back, BarLegend, BarRow, ShareButton } from "../components/WalkCheck";
import { schoolName } from "./Home";

// Shares here are of zone AREA (a ~110 m grid), never of children or homes, and the page says so next to the numbers.
const tenths = (p: number) => Math.round(p / 10);

/** What the closures changed, zone by zone: the share of each old zone whose walk crosses a dangerous road or track. */
export function Schools() {
  const { zones, totals } = useData();
  const { t } = useT();
  const wc = t.wc;
  const sorted = [...zones].sort((a, b) => b.hazardNew.combined - a.hazardNew.combined);
  return (
    <section className="screen">
      <Back />
      <h1>{wc.changedH1}</h1>
      <div className="cols side-first">
        <div className="col">
          <p className="small muted" style={{ fontWeight: 600 }}>{wc.shareOf}</p>
          <BarLegend />
          <div className="bars">
            {sorted.map((z) => (
              <BarRow key={z.nbr} label={schoolName(z.name)} sub={`→ ${z.receiving.map((r) => schoolName(r.name)).join(" / ")}`}
                before={z.hazardOld.combined} now={z.hazardNew.combined} href={`/schools/${z.nbr}`} />
            ))}
          </div>
          <p className="small muted">{wc.tap}</p>
          <p className="small"><strong>{t.notes.area}</strong></p>
          <Link className="btn mob-only" to="/">{wc.checkAddr}</Link>
        </div>
        <div className="col side">
          <div className="stat">
            <span className="n">{wc.inTen(tenths(totals.hazardNew.combined))}</span>
            <span className="t">{wc.bigText}</span>
            <span className="s">{wc.bigBefore(tenths(totals.hazardOld.combined))}</span>
          </div>
          <Link className="btn desk-only" to="/">{wc.checkAddr}</Link>
        </div>
      </div>
    </section>
  );
}

/** One closed zone: its before and now, distance, and the shuttle pickup. */
export function SchoolDetail() {
  const { zones, shuttles } = useData();
  const { lang, t } = useT();
  const wc = t.wc;
  const { nbr } = useParams();
  const z = zones.find((x) => String(x.nbr) === nbr);
  if (!z) return <Schools />;
  const to = z.receiving.map((r) => schoolName(r.name)).join(" / ");
  const title = wc.pair(schoolName(z.name), to);
  const s = shuttles.shuttles.find((x) => x.from.nbr === z.nbr);
  const deltaMi = Math.abs(z.medianDeltaM) / METERS_PER_MILE;
  return (
    <section className="screen">
      <Back />
      <h1>{title}</h1>
      <div className="cols">
        <div className="col">
          <div className="stat warm">
            <span className="n">{wc.inTen(tenths(z.hazardNew.combined))}</span>
            <span className="t">{wc.zoneStat(tenths(z.hazardOld.combined))}</span>
          </div>
          <BarLegend />
          <div className="bars">
            <BarRow label={wc.hazardBar} before={z.hazardOld.combined} now={z.hazardNew.combined} />
            <BarRow label={wc.railBar} before={z.hazardOld.rail} now={z.hazardNew.rail} />
          </div>
          <div className="facts">
            <div className="card"><span className="n">{deltaMi.toFixed(1)} mi</span><span className="t">{z.medianDeltaM >= 0 ? wc.farther : wc.nearer}</span></div>
            <div className="card"><span className="n">{Math.round(z.pctFarther)}%</span><span className="t">{wc.fartherPct}</span></div>
            <div className="card"><span className="n">{Math.round(z.pctOver2New)}%</span><span className="t">{wc.over2}</span></div>
            <div className="card"><span className="n">{z.maxNewMi.toFixed(1)} mi</span><span className="t">{wc.longest}</span></div>
          </div>
          <p className="small"><strong>{t.notes.area}</strong></p>
          {s && (
            <div className="card tint shuttle-card">
              <span className="v">{wc.shuttleTitle}</span>
              <span className="muted">{s.sameSite ? wc.pickupNone : wc.pickup(s.from.name, s.from.address)}</span>
              <span className="small">{t.result.notPublished}</span>
              {!s.sameSite && z.pickupRoads.some((p) => p.share >= 1) && (
                <>
                  <span className="k" style={{ marginTop: 8 }}>{wc.pickupRoadsH}</span>
                  <ul className="plain">
                    {z.pickupRoads.filter((p) => p.share >= 1).map((p) => (
                      <li key={p.name}>{p.name} <span className="muted small">· {wc.pickupRoad(Math.round(p.share), p.pedDangerous)}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
        <div className="col side">
          <Link className="btn" to="/">{wc.checkAddr}</Link>
          {z.demoPoint && (
            <Link className="btn secondary" to={`/prek?${walkQuery(z.demoPoint, t.lookup.samplePoint(schoolName(z.name)))}`}>{t.lookup.samplePoint(schoolName(z.name))}</Link>
          )}
          <ShareButton title={wc.shareTitle} label={wc.share}
            text={wc.msgZone(title, tenths(z.hazardNew.combined), tenths(z.hazardOld.combined), shareUrl(lang))} />
        </div>
      </div>
    </section>
  );
}
