// "Get help": the two requests a principal can send, each shown as the page the school will get.
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useWalkway } from "../lib/ai/walkway";
import { type UiResult } from "../lib/ui/model";
import { type UiWalk, useUiWalk } from "../lib/ui/useUiWalk";
import { WalkwayHelper } from "../components/WalkwayHelper";
import { ActionBar, Back, Paper, PrintDoc, Steps, WhoCard, useUi } from "../components/ui/bits";
import { BusDoc, ZoneDoc, zoneDocFromWalk } from "../components/ui/docs";
import { useShare } from "../components/ui/ShareSheet";
import { daysToApril15 } from "./Home";
import { shareMessage } from "./Walk";

/** The walk screens after the answer need a home in a closed zone; without one, start over. */
function useRequestWalk(): { u: UiWalk; r: UiResult } | null {
  const u = useUiWalk();
  return u?.r ? { u, r: u.r } : null;
}

export function Help() {
  const x = useRequestWalk();
  const { L } = useUi();
  if (!x) return <Navigate to="/" replace />;
  const { u, r } = x;
  return (
    <section className="screen">
      <Back />
      <h1>{L.help_h}</h1>
      <div className="cols">
        <div className="col">
          <Link className="option" to={u.to("bus")}>
            <span className="opt-n">1</span>
            <div><h2>{L.bus_h}</h2><p className="muted">{L.bus_s}</p></div>
            <span className="btn">{L.open_bus} ›</span>
          </Link>
          <Link className="option" to={u.to("schoolzone")}>
            <span className="opt-n">2</span>
            <div><h2>{L.zone_h}</h2><p className="muted">{L.zone_s}</p><p className="due">{L.deadline}</p></div>
            <span className="btn">{L.open_zone} ›</span>
          </Link>
        </div>
        <div className="col side"><WhoCard school={r.recv.name} address={r.recv.address} /></div>
      </div>
    </section>
  );
}

export function Bus() {
  const x = useRequestWalk();
  const { lang, L } = useUi();
  const share = useShare();
  const [walkway] = useWalkway(x ? `${x.u.w.home[0]},${x.u.w.home[1]}` : "");
  if (!x) return <Navigate to="/" replace />;
  const { u, r } = x;
  const doc = <BusDoc r={r} addr={u.addr} walkway={walkway} />;
  return (
    <section className="screen has-bar">
      <PrintDoc>{doc}</PrintDoc>
      <Back />
      <h1>{L.bus_h}</h1>
      <div className="cols">
        <div className="col">
          <Steps list={L.bus_steps} h={L.steps_h} />
          <WhoCard school={r.recv.name} address={r.recv.address} />
          <h2>{L.inside}</h2>
          <ul className="ticks">{L.bus_items.map((i: string) => <li key={i}>{i}</li>)}</ul>
          <WalkwayHelper />
          <p><Link to={u.to("packet")}>{L.self_file} ›</Link></p>
        </div>
        <div className="col side">
          <Paper pages={L.page1}>{doc}</Paper>
          <ActionBar
            btns={[
              { label: L.print_req, primary: true, onClick: () => window.print() },
              { label: L.share, icon: "share", onClick: () => share(`Walk Check request for ${r.recv.name}: ${shareMessage(u, r, lang)}`, L.share_school) },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

export function SchoolZone() {
  const x = useRequestWalk();
  const { lang, L } = useUi();
  const share = useShare();
  const nav = useNavigate();
  if (!x) return <Navigate to="/" replace />;
  const { u, r } = x;
  const roads = r.now.filter((c) => c.kind === "road");
  const doc = <ZoneDoc {...zoneDocFromWalk(r)} />;
  const es = lang === "es";
  const path = (c: (typeof roads)[number]) => {
    const s = c.street;
    if (s && (s.toc || s.borders.includes(r.recv.name)))
      return `${es ? "Camino por escrito: " : "Written path: "}${s.borders.includes(r.recv.name) ? (es ? "colinda con la escuela" : "borders the school") : es ? "vía principal o colectora" : "thoroughfare or collector"}`;
    return es ? "Calle local: se pide un guardia y un paso peatonal" : "Local street: asks for a guard and a crosswalk instead";
  };
  return (
    <section className="screen has-bar">
      <PrintDoc>{doc}</PrintDoc>
      <Back />
      <h1>{L.zone_h}</h1>
      <div className="cols">
        <div className="col">
          <p className="due big">{L.dl_h}, {daysToApril15()[1]} <span className="muted">· {L.dl_s}</span></p>
          <Steps list={L.zone_steps} h={L.steps_h} />
          <h2>{L.streets}</h2>
          {roads.length ? (
            <ol className="xlist compact">
              {roads.map((c, i) => (
                <li key={c.key} className="xrow">
                  <span className="n">{i + 1}</span>
                  <div className="xbody"><h3>{c.name}</h3><p className="muted">{path(c)} · {L.crashes(c.pc, c.pd)}</p></div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{L.streets_none}</p>
          )}
          <WhoCard school={r.recv.name} address={r.recv.address} />
          {u.prek && <p><button type="button" className="linkbtn" onClick={() => nav(u.to("bus"))}>{L.bus_h} ›</button></p>}
        </div>
        <div className="col side">
          <Paper pages={L.page1}>{doc}</Paper>
          <ActionBar
            btns={[
              { label: L.print_req, primary: true, onClick: () => window.print() },
              { label: L.share, icon: "share", onClick: () => share(`Walk Check request for ${r.recv.name}: ${shareMessage(u, r, lang)}`, L.share_school) },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
