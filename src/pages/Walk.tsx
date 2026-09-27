import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { METERS_PER_MILE } from "../lib/geo";
import { mi } from "../lib/format";
import { dataText, shareUrl, useT } from "../lib/i18n";
import { type Walk, crossCounts, useWalk } from "../lib/walk";
import { CrossingPlan, WhoCanChange } from "../components/CrossingPlan";
import { FitTo, MapBase, MapLegend } from "../components/MapBase";
import { DatesLine } from "../components/Notes";
import { RouteLayers } from "../components/RouteLayers";
import { shuttlePoints } from "../components/ShuttleLayer";
import { Back, RouteStrip, ShareButton } from "../components/WalkCheck";
import { schoolName } from "./Home";

export function MissingWalk() {
  const { t } = useT();
  return (
    <section className="screen">
      <p>{t.plan.missing} <Link to="/">{t.plan.start}</Link>.</p>
    </section>
  );
}

/** Step two, for a closed-zone home: HISD's bus rules differ for Pre-K, so the answer screen needs to know. */
export function Prek() {
  const w = useWalk();
  const { t } = useT();
  const nav = useNavigate();
  if (!w) return <MissingWalk />;
  const pick = (yes: boolean) => {
    const p = new URLSearchParams(w.params);
    p.set("prek", yes ? "1" : "0");
    nav(`/walk?${p}`);
  };
  return (
    <section className="screen" style={{ maxWidth: 560 }}>
      <Back />
      <p className="addr-line">{w.addr}</p>
      <h1>{t.wc.prekQ}</h1>
      <p className="muted">{t.wc.prekWhy}</p>
      <button type="button" className="choice" onClick={() => pick(true)}><b>{t.wc.yes}</b><span>{t.wc.yesSub}</span></button>
      <button type="button" className="choice" onClick={() => pick(false)}><b>{t.wc.no}</b><span>{t.wc.noSub}</span></button>
    </section>
  );
}

/** The map of both walks. On phones it stays folded until asked for, so the answer comes first. */
export function WalkMap({ w, stop, plans = true }: { w: Walk; stop?: boolean; plans?: boolean }) {
  const d = useData();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { r, shuttle, sw } = w;
  if (!r.now) return null;
  const pts = [w.home, r.now.school.loc, ...(r.old ? [r.old.school.loc] : []), ...(sw && shuttle ? shuttlePoints([shuttle]) : [])];
  return (
    <>
      <button type="button" className="btn secondary mob-only no-print" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.lookup.hideMap : t.wc.showMap}
      </button>
      <div className={`walk-map${open ? "" : " folded"}`} role="img" aria-label={t.wc.mapAlt}>
        <MapBase>
          <RouteLayers d={d} r={r} shuttle={shuttle} plans={plans ? w.plans : undefined} stop={stop ? w.stop : undefined} />
          <FitTo points={pts} />
        </MapBase>
        <MapLegend shuttle={!!shuttle} walks plan={plans} />
      </div>
    </>
  );
}

function NotClosed({ w }: { w: Walk }) {
  const d = useData();
  const { lang, t } = useT();
  const { r } = w;
  const names = d.zones.map((z) => schoolName(z.name));
  const namesText = `${names.slice(0, -1).join(", ")}${lang === "es" ? " o " : " or "}${names[names.length - 1]}`;
  const all = new URLSearchParams(w.params);
  all.set("all", "1");
  if (!r.now)
    return (
      <section className="screen" style={{ maxWidth: 560 }}>
        <Back />
        <p className="addr-line">{w.addr}</p>
        <h1>{t.wc.outside}</h1>
        <Link className="btn secondary" to="/">{t.wc.another}</Link>
      </section>
    );
  const same = r.old?.school.nbr === r.now.school.nbr;
  return (
    <section className="screen" style={{ maxWidth: 560 }}>
      <Back />
      <p className="addr-line">{w.addr}</p>
      <h1>{t.wc.notClosed}</h1>
      <div className="card tint">
        <span className="k">{t.wc.zoned}</span>
        <span className="v">{r.now.school.name}</span>
        <span className="muted small">{same ? t.wc.same : r.old ? t.wc.was(r.old.school.name) : r.now.school.address}</span>
      </div>
      <Link className="btn" to={`/walk?${all}`}>{t.wc.seeWalk}</Link>
      <Link className="btn secondary" to="/schools">{t.wc.seeClosed}</Link>
      <Link className="btn secondary" to="/">{t.wc.another}</Link>
      <div className="card" style={{ gap: 10 }}>
        <span className="v">{t.wc.know(namesText)}</span>
        <ShareButton title={t.wc.shareTitle} text={t.wc.msgSite(shareUrl(lang).replace(/#.*$/, ""))} label={t.wc.share} />
      </div>
    </section>
  );
}

/** Step three: the answer. One sentence, then the walk in order, where to cross, the shuttle, and what to do. */
export default function WalkScreen() {
  const w = useWalk();
  const { lang, t } = useT();
  if (!w) return <MissingWalk />;
  const { r, sw, shuttle } = w;
  if (!r.now || (!r.closedZone && w.params.get("all") !== "1")) return <NotClosed w={w} />;

  const tr = t.result, wc = t.wc;
  const now = r.now;
  const nowName = now.school.name;
  const oldName = r.old?.school.name ?? "";
  const c = crossCounts(now.hazards);
  const railOld = !!sw && crossCounts(sw.hazards).rail;
  const beyond2 = now.distance >= 2 * METERS_PER_MILE;
  const dest = shuttle ? shuttle.to.map((x) => (x.grades ? `${x.name} (${dataText(lang, x.grades)})` : x.name)).join(tr.and) : "";
  const sms = wc.msg(w.addr, nowName, tr.crosses(c.rail, c.roads), shareUrl(lang));

  return (
    <section className="screen has-bar">
      <Back />
      <p className="addr-line">{w.addr}{w.prek ? " · Pre-K" : ""}</p>
      <h1>{wc.verdict(nowName, c.rail, c.roads)}</h1>
      {w.prek && (
        <div className="card warm edge">
          <span className="v">{wc.prekTitle}</span>
          <span>{wc.prekBody}</span>
        </div>
      )}

      <div className="cols">
        <div className="col">
          {r.closedZone && r.old && (
            <div className="cmp">
              <div className="card tint">
                <span className="k">{wc.lastYear}</span>
                <span className="name">{schoolName(oldName)}</span>
                <span className="muted small">{mi(r.old.distance)} · {wc.nCrossings(r.old.hazards.length)}</span>
              </div>
              <div className="card warm">
                <span className="k">{wc.now}</span>
                <span className="name">{schoolName(nowName)}</span>
                <span className="muted small">{mi(now.distance)} · {wc.nCrossings(now.hazards.length)}</span>
              </div>
            </div>
          )}

          <div className="route">
            <span className="k">{wc.walk}</span>
            <RouteStrip hazards={now.hazards} school={nowName} />
          </div>

          <h2>{wc.whereToCross}</h2>
          {w.nowPlan && <CrossingPlan plan={w.nowPlan} />}

          {shuttle && !shuttle.sameSite && (
            <div className="card tint shuttle-card" style={{ gap: 10 }}>
              <span className="v">{wc.shuttleTitle}</span>
              <span>{tr.shuttleBody(oldName, shuttle.from.address, dest)}</span>
              <span className="small">{tr.notPublished}</span>
              {shuttle.flags.length > 0 && <span className="small muted">{shuttle.flags.map((f) => dataText(lang, f)).join(" ")}</span>}
              {sw && w.swPlan && (
                <>
                  <h2 style={{ fontSize: 18, marginTop: 6 }}>{wc.shuttleWalk(oldName)}</h2>
                  <span><strong>{tr.crosses(railOld, crossCounts(sw.hazards).roads)}</strong> <span className="muted">({tr.miles(mi(sw.distance))})</span></span>
                  {sw.hazards.length > 0 && <CrossingPlan plan={w.swPlan} />}
                </>
              )}
            </div>
          )}

          <WhoCanChange plans={w.plans} school={nowName} />

          <div className={`card${beyond2 ? " tint" : ""}`}>
            <span className="k">{!beyond2 && sw ? tr.cliffLabel : tr.distanceLabel}</span>
            <span>{beyond2 ? tr.over2(mi(now.distance), nowName) : sw ? tr.cliff(mi(now.distance), nowName) : tr.under2(mi(now.distance), nowName)}</span>
          </div>
          {sw && railOld !== c.rail && <p className="note rail">{railOld ? tr.shuttleAddsRail(nowName) : tr.shuttleAvoidsRail(nowName)}</p>}
          {(c.rail || railOld) && <p className="note rail"><strong>{tr.railLabel}:</strong> {tr.railNote}</p>}
          {(now.hazards.length > 0 || (sw?.hazards.length ?? 0) > 0) && <p className="small muted">{t.cross.caveat}</p>}
          <DatesLine />
        </div>

        <div className="col side">
          <WalkMap w={w} />
          <div className="bar-fixed">
            {/* Pre-K gets no HISD bus, so a school zone leads, when there's a road to ask about. */}
            <Link className="btn primary" to={`/${w.prek && c.roads ? "schoolzone" : "help"}?${w.params}`}>{w.prek && c.roads ? wc.askZone : wc.ask}</Link>
            <Link className="btn secondary" to={`/plan?${w.params}`} aria-label={wc.print}>{wc.printShort}</Link>
            <ShareButton title={wc.shareTitle} text={sms} label={wc.share} />
          </div>
        </div>
      </div>
    </section>
  );
}
