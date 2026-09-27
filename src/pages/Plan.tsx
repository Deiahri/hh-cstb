import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { analyzeAddress } from "../lib/analyze";
import { shuttleFrom, useData } from "../lib/data";
import type { LngLat } from "../lib/geo";
import { coord, mi } from "../lib/format";
import { useT } from "../lib/i18n";
import { CrossingPlan, WhoCanChange } from "../components/CrossingPlan";
import { FitTo, MapBase, MapLegend } from "../components/MapBase";
import { DatesLine } from "../components/Notes";
import { shuttlePoints } from "../components/ShuttleLayer";
import { RouteLayers, shuttleWalk, walkPlans } from "./Lookup";

/**
 * The family's one-page walk plan, in their language: walk it once first, then each crossing with where to cross,
 * then three one-time actions. Messages that ask for one-time actions work better than ones asking for daily
 * vigilance (warning-families report). The HISD packet is a separate page, in English.
 */
export default function Plan() {
  const d = useData();
  const { t } = useT();
  const tp = t.plan;
  const [params] = useSearchParams();
  const home: LngLat = [Number(params.get("lng")), Number(params.get("lat"))];
  const addr = params.get("addr") ?? coord(home);
  const r = useMemo(() => analyzeAddress(home, d.ds), [home[0], home[1], d.ds]);

  if (!Number.isFinite(home[0]) || !r.now)
    return (
      <div className="page">
        <p>{tp.missing} <Link to="/">{tp.start}</Link>.</p>
      </div>
    );

  const shuttle = r.oldZone ? shuttleFrom(d, Number(r.oldZone.Campus__Number)) : undefined;
  const sw = shuttleWalk(r, shuttle);
  const nowName = r.now.school.name;
  const oldName = r.old?.school.name ?? "";
  // walkPlans returns the shuttle walk first when there is one, then the walk to the new school.
  const plans = walkPlans(d, r, shuttle);
  const walks = [
    ...(sw ? [{ title: tp.walkShuttle(oldName), route: sw }] : []),
    { title: sw ? tp.walkDirect(nowName) : tp.walkOnly(nowName), route: r.now },
  ].map((w, i) => ({ ...w, plan: plans[i] }));
  const packetParams = new URLSearchParams({ lat: String(home[1]), lng: String(home[0]), addr });

  return (
    // Five or more crossings across both walks (about 7% of the sampled area) print smaller, so the plan stays on one page.
    <div className={`page packet walk-plan${plans.reduce((n, p) => n + p.steps.length, 0) >= 5 ? " dense" : ""}`}>
      <div className="no-print packet-actions">
        <Link to={`/?${params}`} className="button">{tp.back}</Link>
        <button type="button" className="button primary" onClick={() => window.print()}>{tp.print}</button>
      </div>

      <header className="packet-head">
        <p className="eyebrow">{tp.eyebrow}</p>
        <h1>{tp.title(nowName)}</h1>
        <p className="small">{tp.forHome(addr)}</p>
      </header>

      <p className="plan-first">{tp.first}</p>

      {/* On paper the map sits beside the crossings, so the whole plan fits one page. */}
      <div className="plan-body">
        <div className="plan-walks">
          {walks.map(({ title, route, plan }) => (
            <section key={title} className="plan-walk">
              <h2>{title} <span className="muted small">({t.result.miles(mi(route.distance))})</span></h2>
              {route.hazards.length ? <CrossingPlan plan={plan} crashes={false} /> : <p>{tp.noCrossings}</p>}
            </section>
          ))}
          <WhoCanChange plans={plans} school={nowName} />
        </div>

        <div className="plan-side">
        <section className="map-section">
          <MapBase className="map print-map" interactive={false}>
            <RouteLayers d={d} r={r} shuttle={sw ? shuttle : undefined} plans={plans} />
            <FitTo points={[home, r.now.school.loc, ...(sw && r.old ? [r.old.school.loc] : []), ...(sw && shuttle ? shuttlePoints([shuttle]) : [])]} />
          </MapBase>
          <p className="small">{tp.mapNote}</p>
          <MapLegend shuttle={!!sw} walks plan />
        </section>

        <section className="plan-once">
          <h2>{tp.doOnce}</h2>
          <ol>
            <li>{tp.do1}</li>
            <li>{sw ? tp.do2Shuttle(oldName) : tp.do2(nowName)}</li>
            <li>{tp.do3} <Link className="no-print" to={`/packet?${packetParams}`}>{t.result.packetButton}</Link></li>
          </ol>
        </section>
        </div>
      </div>

      <footer className="packet-foot">
        <p>{t.cross.caveat}</p>
        <DatesLine />
        <p>{tp.by}</p>
      </footer>
    </div>
  );
}
