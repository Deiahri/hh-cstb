// Home, the map picker, the Pre-K question and "not a closed zone": the first screens of Walk Check.
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { analyzeAddress } from "../lib/analyze";
import { useData } from "../lib/data";
import { geocode } from "../lib/geocode";
import type { LngLat } from "../lib/geo";
import { closedZones, short } from "../lib/ui/model";
import { walkLink } from "../lib/ui/useUiWalk";
import { Arrow, Back, Steps, useUi } from "../components/ui/bits";
import { useShare } from "../components/ui/ShareSheet";
import { WcMap } from "../components/ui/WcMap";
import { Walker } from "../components/ui/Checking";

/** Days to the next April 15, and its year. */
export function daysToApril15(): [number, number] {
  const n = new Date();
  let d = new Date(n.getFullYear(), 3, 15);
  if (d < n) d = new Date(n.getFullYear() + 1, 3, 15);
  return [Math.ceil((d.getTime() - n.getTime()) / 864e5), d.getFullYear()];
}

/** The sample point's label, in the page's language. */
export const sampleLabel = (zone: string, lang: "en" | "es") =>
  lang === "es" ? `Punto de muestra en la zona de ${short(zone)}` : `Sample point in the old ${short(zone)} area`;

/** Where a home goes: its walk, or the "not in an HISD elementary zone" screen. */
function useGoHome() {
  const d = useData();
  const nav = useNavigate();
  return (p: LngLat, addr: string, geocoded = false) => {
    const r = analyzeAddress(p, d.ds);
    // Any HISD elementary zone gets its walk; the closed zones' walks add last year and the shuttle.
    nav(r.now ? walkLink(p, addr, { geocoded }) : `/nozone?${new URLSearchParams({ addr })}`);
  };
}

export default function Home() {
  const d = useData();
  const { lang, L } = useUi();
  const go = useGoHome();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  // Links from before the redesign put the address on the home page.
  if (params.has("lat") && params.has("lng")) return <Navigate to={`/walk?${params}`} replace />;
  const zones = closedZones(d);
  const [days] = daysToApril15();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setBusy(true);
    setErr(false);
    try {
      const found = await geocode(/houston|tx\b|texas/i.test(v) ? v : `${v}, Houston, TX`);
      if (found[0]) return go(found[0].loc, found[0].address.replace(/, Houston, Texas.*$/, "").replace(/, TX.*$/, ""), true);
      setErr(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <div className="hero">
        <div className="hero-copy">
          <h1>{L.h_check}</h1>
          <Steps list={L.how} />
        </div>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="addr">{L.addr}</label>
            <input className="input" id="addr" name="addr" autoComplete="street-address" placeholder={L.addr_ph} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={busy}>{busy ? <><Walker size={26} />{L.checking}</> : L.go}</button>
          {err && <p className="err">{L.notfound}</p>}
          <Link className="linkbtn" to="/pick">{L.pick}</Link>
          <p className="small muted try">{L.trya}</p>
          <div className="chips">
            {zones.map((z) => (
              <button key={z.nbr} type="button" className="chip" onClick={() => go(z.demo, sampleLabel(z.name, lang))}>{short(z.name)}</button>
            ))}
          </div>
        </form>
      </div>

      <div className="sec"><h2>{L.closed}</h2></div>
      <div className="list grid4">
        {zones.map((z) => (
          <Link key={z.nbr} className="list-row pair-row" to={`/zone/${z.nbr}`}>
            <span className="pair"><span className="was">{short(z.name)}</span><span className="arrow" aria-hidden="true">→</span><span className="now">{z.receiving.map((r) => short(r.name)).join(" / ")}</span></span>
            <span className="go">{L.see} <Arrow /></span>
          </Link>
        ))}
      </div>

      <div className="sec"><h2>{L.staff_h}</h2></div>
      <div className="staffgrid">
        {L.staff.map((s: { h: string; b: string; href: string }) => (
          <Link key={s.href} className="staffcard" to={s.href.replace(/^#/, "")}>
            <h3>{s.h}{s.href === "#/april15" && <span className="muted"> · {L.days(days)}</span>}</h3>
            <p className="muted">{s.b}</p>
          </Link>
        ))}
      </div>

      <div className="sec"><h2>{L.src_h}</h2><p className="muted"><Link to="/sources">{L.src_link} ›</Link></p></div>
    </section>
  );
}

export function Pick() {
  const { L } = useUi();
  const go = useGoHome();
  const [p, setP] = useState<LngLat | null>(null);
  return (
    <section className="screen">
      <Back />
      <h1>{L.pick_h}</h1>
      <WcMap kind="pick" height={matchMedia("(max-width:899px)").matches ? 420 : 520} onPick={setP} />
      <div className="row"><button type="button" className="btn" disabled={!p} onClick={() => p && go(p, L.spot)}>{L.use}</button></div>
    </section>
  );
}

/** "Is your child in Pre-K?", for links that ask first. The walk page also has the toggle. */
export function Prek() {
  const { L } = useUi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  if (!params.has("lat")) return <Navigate to="/" replace />;
  const pick = (yes: boolean) => {
    const p = new URLSearchParams(params);
    p.set("prek", yes ? "1" : "0");
    nav(`/walk?${p}`);
  };
  return (
    <section className="screen narrow">
      <Back />
      <p className="eyebrow">{params.get("addr")}</p>
      <h1>{L.prek_h}</h1>
      <p className="muted">{L.prek_why}</p>
      <button type="button" className="choice" onClick={() => pick(false)}><b>{L.no}</b><span>{L.no_s}</span></button>
      <button type="button" className="choice" onClick={() => pick(true)}><b>{L.yes}</b><span>{L.yes_s}</span></button>
    </section>
  );
}

export function NoZone() {
  const { L } = useUi();
  const share = useShare();
  const [params] = useSearchParams();
  const site = `${location.origin}${location.pathname}`;
  return (
    <section className="screen narrow">
      <Back />
      <p className="eyebrow">{params.get("addr")}</p>
      <h1>{L.nz_h}</h1>
      <Link className="btn" to="/zones">{L.seeclosed}</Link>
      <Link className="btn secondary" to="/">{L.another}</Link>
      <p className="muted">
        {L.know}{" "}
        <button type="button" className="linkbtn" onClick={() => share(`Walk Check shows what a child’s walk to the new school crosses, where to cross, and how to ask for a bus or a school zone. ${site}`, L.share_h)}>
          {L.share}
        </button>
      </p>
    </section>
  );
}
