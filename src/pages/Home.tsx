// Home, the map picker, the Pre-K question and "not in an HISD zone": the first screens of Walk Check.
import { type FormEvent, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { analyzeAddress } from "../lib/analyze";
import { useData } from "../lib/data";
import { geocode } from "../lib/geocode";
import type { LngLat } from "../lib/geo";
import { closedZones, short } from "../lib/ui/model";
import { Arrow, Back, useUi } from "../components/ui/bits";
import { WcMap } from "../components/ui/WcMap";
import { checkLink } from "./Check";

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

/** Where a home goes: its check, or "not in an HISD elementary zone". */
function useGoHome() {
  const d = useData();
  const nav = useNavigate();
  return (p: LngLat, addr: string, geocoded = false) => {
    const r = analyzeAddress(p, d.ds);
    nav(r.now ? checkLink(p, addr) + (geocoded ? "&geo=1" : "") : `/nozone?${new URLSearchParams({ addr })}`);
  };
}

/** A house number and something after it. Anything less can't be geocoded to a home. */
export const looksLikeAddress = (v: string) => /\d/.test(v) && /[a-z]{2}/i.test(v) && v.trim().length >= 5;

export default function Home() {
  const d = useData();
  const { lang, L } = useUi();
  const go = useGoHome();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Links from before the redesign put the address on the home page.
  if (params.has("lat") && params.has("lng")) return <Navigate to={`/walk?${params}`} replace />;
  const zones = closedZones(d);
  const demo = `${zones[0].address}, Houston, TX`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!looksLikeAddress(v)) {
      setErr(L.bad_addr(demo));
      input.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const found = await geocode(/houston|tx\b|texas/i.test(v) ? v : `${v}, Houston, TX`);
      if (found[0]) return go(found[0].loc, found[0].address.replace(/, Houston, Texas.*$/, "").replace(/, TX.*$/, ""), true);
      setErr(L.notfound);
    } catch {
      setErr(L.notfound);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen home">
      <h1>{L.h_check}</h1>
      <form className="form" onSubmit={submit} noValidate>
        <label className="label" htmlFor="addr">{L.addr}</label>
        <input
          ref={input}
          className="input"
          id="addr"
          name="addr"
          autoComplete="street-address"
          enterKeyHint="go"
          required
          placeholder={L.addr_ph}
          aria-invalid={!!err}
          aria-describedby={err ? "addr-err" : undefined}
          value={q}
          onChange={(e) => { setQ(e.target.value); setErr(null); }}
        />
        {err && <p className="err" id="addr-err" role="alert">{err}</p>}
        <button className="btn go" type="submit" disabled={busy}>{busy ? L.checking : L.go}</button>
        <div className="formlinks">
          <button type="button" className="linkbtn" onClick={() => { setQ(demo); setErr(null); input.current?.focus(); }}>{L.demo}</button>
          <Link to="/pick">{L.pick}</Link>
        </div>
      </form>

      <div className="sec">
        <h2>{L.examples}</h2>
        <p className="muted small">{L.ex_sub}</p>
      </div>
      <div className="exlist">
        {zones.map((z) => (
          <button key={z.nbr} type="button" className="ex" onClick={() => go(z.demo, sampleLabel(z.name, lang))}>
            <span className="pair"><span className="was">{short(z.name)}</span><span className="arrow" aria-hidden="true">→</span><span className="now">{z.receiving.map((r) => short(r.name)).join(" / ")}</span></span>
            <Arrow />
          </button>
        ))}
      </div>
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
  const [params] = useSearchParams();
  return (
    <section className="screen narrow">
      <p className="addrline">{params.get("addr")}</p>
      <h1>{L.nz_h}</h1>
      <Link className="btn" to="/">{L.another}</Link>
      <Link className="btn secondary" to="/pick">{L.pick}</Link>
    </section>
  );
}
