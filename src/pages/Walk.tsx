// The answer: what the walk crosses, in order, where to cross each one, the shuttle, and what happens after it. A home in
// any other HISD elementary zone gets the same walk, map and crossings, without the closure parts (last year, shuttle).
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { type UiCheck, type UiCrossing, type UiResult, crossList, crossingAdvice, dataDates, mi, short, toCheck, whoFor } from "../lib/ui/model";
import { type UiWalk, useUiWalk } from "../lib/ui/useUiWalk";
import { AskResult } from "../components/AskResult";
import { ActionBar, Back, PrintDoc, useUi } from "../components/ui/bits";
import { PlanDoc } from "../components/ui/docs";
import { useShare } from "../components/ui/ShareSheet";
import { WalkMap, WalkMapProvider, usePhone, useWalkMapCtl } from "../components/ui/WcMap";
import { Checking } from "../components/ui/Checking";

/** The message the Share button sends: where the walk goes, what it crosses, and the link back. */
export function shareMessage(u: UiWalk, r: UiResult, lang: "en" | "es") {
  const link = `${location.origin}${location.pathname}#${u.to("walk")}`;
  const cross = r.now.length ? crossList(r.now, lang) : lang === "es" ? "nada de las listas de la Ciudad" : "nothing on the City’s lists";
  return lang === "es"
    ? `Walk Check: el camino de ${u.addr} a ${r.recv.name} cruza ${cross}. Autobús gratis desde ${r.closed.name} hasta 2028. Vea el camino: ${link}`
    : `Walk Check: the walk from ${u.addr} to ${r.recv.name} crosses ${cross}. Free shuttle from ${r.closed.name} until 2028. See the walk: ${link}`;
}

function CrossingRow({ c, i, school }: { c: UiCrossing; i: number; school: string }) {
  const { lang, L } = useUi();
  const ctl = useWalkMapCtl();
  const tags = c.kind === "rail" ? [L.tag_rail] : [c.ped ? L.tag_ped : null, L.tag_hin].filter(Boolean);
  const { ask, who } = whoFor(c, school, L);
  return (
    <li className={`xrow ${c.kind}`} data-x={i} onClick={(e) => !(e.target as HTMLElement).closest("details,a,button") && ctl.current?.show(i)}>
      <span className="n">{i + 1}</span>
      <div className="xbody">
        <h3>
          {c.kind === "rail" ? `${lang === "es" ? "Vías de tren" : "Train tracks"} · ${c.name}` : c.name}{" "}
          <button type="button" className="showmap" onClick={(e) => { e.stopPropagation(); ctl.current?.show(i); }}>{L.showmap} ›</button>
        </h3>
        <p className="tags muted">{tags.join(" · ")}{c.kind === "road" ? ` · ${L.crashes(c.pc, c.pd)}` : ""}</p>
        <p className="adv">{crossingAdvice(c, L)}</p>
        <details className="who"><summary>{ask}</summary><p>{who}</p></details>
      </div>
    </li>
  );
}

/** On a desktop, the crossing nearest the reading line lights up on the map. */
function useScrollSpy(list: React.RefObject<HTMLOListElement | null>, phone: boolean) {
  const ctl = useWalkMapCtl();
  useEffect(() => {
    const ol = list.current;
    if (phone || !ol) return;
    const rows = [...ol.querySelectorAll<HTMLElement>(".xrow")];
    let cur = -1, tick = false;
    const spy = () => {
      tick = false;
      const line = innerHeight * 0.38;
      let bi = -1;
      rows.forEach((r, i) => { if (r.getBoundingClientRect().top <= line) bi = i; });
      if (rows[0] && rows[0].getBoundingClientRect().top > innerHeight * 0.9) bi = -1;
      if (bi !== cur) { cur = bi; ctl.current?.hot(bi); }
    };
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(spy); } };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [list, phone, ctl]);
}

export default function WalkScreen() {
  const d = useData();
  const u = useUiWalk();
  if (!u) return <Navigate to="/" replace />;
  if (u.w.pending) return <Checking />;
  if (u.r) return <WalkMapProvider><WalkBody u={u} r={u.r} /></WalkMapProvider>;
  // Not a closed zone: still any HISD elementary zone's walk, when the home is in one.
  const c = toCheck(d, u.w);
  if (!c) return <Navigate to={`/nozone?${new URLSearchParams({ addr: u.addr })}`} replace />;
  return <WalkMapProvider><OpenWalkBody u={u} c={c} /></WalkMapProvider>;
}

/** Keeps the address row's "Found / Fix" and the words under the list the same on both kinds of walk. */
function AddrLine({ u }: { u: UiWalk }) {
  const { L } = useUi();
  const sample = !u.geocoded;
  return (
    <p className="addr">
      <span className="muted">{sample ? "" : `${L.found}: `}</span><b>{u.addr}</b> <Link to="/">{sample ? L.usemine : L.fix} ›</Link>
    </p>
  );
}

function Notes({ routed }: { routed: boolean }) {
  const d = useData();
  const { lang, L } = useUi();
  const dates = dataDates(d);
  return (
    <>
      <p className="small muted foot">{routed ? L.note_route : L.note_lines} {L.note_lights}</p>
      <p className="small muted foot">
        {L.dates}: {lang === "es" ? "listas de choques de la Ciudad" : "City crash lists"} {dates.crash} · HISD {lang === "es" ? "vías" : "rail"} {dates.rail} ·{" "}
        {lang === "es" ? "límites" : "boundaries"} {dates.zones} · {lang === "es" ? "semáforos" : "traffic lights"} {dates.signals} ·{" "}
        {lang === "es" ? "cruces de vías" : "rail crossings"} {dates.xings}. <Link to="/sources">{L.src_link} ›</Link>
      </p>
    </>
  );
}

/** A home in an HISD elementary zone whose school didn't close: the walk to that school, with no shuttle and no "last year". */
function OpenWalkBody({ u, c }: { u: UiWalk; c: UiCheck }) {
  const { lang, L } = useUi();
  const share = useShare();
  const phone = usePhone();
  const list = useRef<HTMLOListElement>(null);
  useScrollSpy(list, phone);
  const to = short(c.school.name);
  const roads = c.crossings.filter((x) => x.kind === "road").length, rails = c.crossings.length - roads;
  const mins = Math.round((c.distM / 1609.344 / 2.5) * 60);
  const link = `${location.origin}${location.pathname}#${u.to("walk")}`;
  const cross = c.crossings.length ? crossList(c.crossings, lang) : lang === "es" ? "nada de las listas de la Ciudad" : "nothing on the City’s lists";
  const msg = lang === "es"
    ? `Walk Check: el camino de ${u.addr} a ${c.school.name} cruza ${cross}. Vea el camino: ${link}`
    : `Walk Check: the walk from ${u.addr} to ${c.school.name} crosses ${cross}. See the walk: ${link}`;

  return (
    <section className="screen has-bar">
      {u.shared && <p className="shared">{L.shared_h} <Link to="/">{L.shared_b} ›</Link></p>}
      <Back />
      <h1>{L.verdict(to, roads, rails)}</h1>
      <p className="summary"><span>{mi(c.distM)} mi</span><span>{L.mins(mins)}</span><span>{c.crossings.length ? L.crossings(c.crossings.length) : L.nothing}</span></p>
      <AddrLine u={u} />

      <div className="cols">
        <div className="col">
          {phone && <div className="mob-only"><WalkMap c={c} height={340} /></div>}
          <h2>{L.where}</h2>
          {c.crossings.length ? (
            <ol className="xlist" ref={list}>{c.crossings.map((x, i) => <CrossingRow key={x.key} c={x} i={i} school={c.school.name} />)}</ol>
          ) : (
            <p className="muted">{L.xnone[0].toUpperCase() + L.xnone.slice(1)}. {L.plan_anyway}</p>
          )}
          <p>{L.after_b(to, mi(c.lineM))}</p>
          <AskResult w={u.w} />
          <Notes routed={!!c.path} />
        </div>
        <div className="col side sticky">
          {!phone && <div className="desk-only"><WalkMap c={c} height={440} /></div>}
          <ActionBar btns={[{ label: L.share, icon: "share", primary: true, onClick: () => share(msg, L.share_h) }]} />
        </div>
      </div>
    </section>
  );
}

function WalkBody({ u, r }: { u: UiWalk; r: UiResult }) {
  const d = useData();
  const { lang, L } = useUi();
  const nav = useNavigate();
  const share = useShare();
  const phone = usePhone();
  const dates = dataDates(d);
  const list = useRef<HTMLOListElement>(null);
  const anchor = useRef<HTMLHeadingElement>(null);
  const [ctxOn, setCtxOn] = useState(false);
  useScrollSpy(list, phone);
  useEffect(() => {
    const el = anchor.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([en]) => setCtxOn(!en.isIntersecting && en.boundingClientRect.top < 0), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const to = short(r.recv.name), from = short(r.closed.name);
  const xb = r.before.length ? L.xsome(crossList(r.before, lang)) : L.xnone;
  const mins = Math.round((r.distNowM / 1609.344 / 2.5) * 60);
  const setGrade = (prek: boolean) => nav(u.to("walk", { prek: prek ? "1" : "0" }), { replace: true });
  const printLabel = u.prek ? L.print_plan : L.print;

  return (
    <section className="screen has-bar">
      <PrintDoc><PlanDoc r={r} addr={u.addr} dates={dates} /></PrintDoc>
      {u.shared && <p className="shared">{L.shared_h} <Link to="/">{L.shared_b} ›</Link></p>}
      <div className={`ctx${ctxOn ? " is-on" : ""}`} aria-hidden="true">
        <b>{L.walkto} {to}</b><span>{r.now.length ? L.crossings(r.now.length) : L.nothing} · {mi(r.distNowM)} mi</span>
      </div>
      <Back />
      <h1 ref={anchor}>{L.verdict(to, r.roads, r.rails)}</h1>
      <p className="summary"><span>{mi(r.distNowM)} mi</span><span>{L.mins(mins)}</span><span>{r.now.length ? L.crossings(r.now.length) : L.nothing}</span><span>{L.shuttle_s}</span></p>
      <AddrLine u={u} />
      <div className="grade" role="group" aria-label={L.grade_q}>
        <span className="muted">{L.grade_q}</span>
        <button type="button" className={`seg${u.prek ? "" : " is-on"}`} aria-pressed={!u.prek} onClick={() => setGrade(false)}>{L.grade_k}</button>
        <button type="button" className={`seg${u.prek ? " is-on" : ""}`} aria-pressed={u.prek} onClick={() => setGrade(true)}>{L.grade_pk}</button>
      </div>
      {u.prek && <p className="notice">{L.after_prek}</p>}

      <div className="cols">
        <div className="col">
          <div className="cmp">
            <div className="cmp-row tint"><span className="k">{L.lastyear}</span><span className="name">{from}</span><span className="meta">{mi(r.distBeforeM)} mi · {r.before.length ? L.crossings(r.before.length) : L.nothing}</span></div>
            <div className="cmp-row warm"><span className="k">{L.now}</span><span className="name">{to}</span><span className="meta">{mi(r.distNowM)} mi · {r.now.length ? L.crossings(r.now.length) : L.nothing}</span></div>
          </div>
          {phone && <div className="mob-only"><WalkMap r={r} height={340} /></div>}
          <h2>{L.where}</h2>
          {r.now.length ? (
            <>
              <ol className="xlist" ref={list}>{r.now.map((c, i) => <CrossingRow key={c.key} c={c} i={i} school={r.recv.name} />)}</ol>
            </>
          ) : (
            <p className="muted">{L.xnone[0].toUpperCase() + L.xnone.slice(1)}. {L.plan_anyway}</p>
          )}
          <h2>{L.shuttle_h(r.closed.name)}</h2>
          <p>{L.shuttle_b(r.closed.name, r.closed.address, mi(r.distBeforeM), xb)}</p>
          <p className="muted">{L.shuttle_c}</p>
          <h2>{L.after_h}</h2>
          <p>{L.after_b(to, mi(r.lineNowM))}</p>
          <AskResult w={u.w} bus={u.to("bus")} />
          <Notes routed={!!r.path} />
        </div>
        <div className="col side sticky">
          {!phone && <div className="desk-only"><WalkMap r={r} height={440} /></div>}
          <ActionBar
            btns={[
              u.prek
                ? { label: L.askzone, primary: true, onClick: () => nav(u.to("schoolzone")) }
                : { label: L.gethelp, primary: true, onClick: () => nav(u.to("help")) },
              { label: printLabel, icon: "print", onClick: () => window.print() },
              { label: L.share, icon: "share", onClick: () => share(shareMessage(u, r, lang), L.share_h) },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
