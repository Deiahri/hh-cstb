// The answer for any HISD elementary address, on one phone screen: the verdict, the map, the danger points in order,
// and who to call. Everything longer lives on /walk (closed zones) and the reading pages.
import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { useData } from "../lib/data";
import { HISD_LINE, HPW_EMAIL } from "../lib/ui/contacts";
import { type UiCheck, type UiCrossing, dangerNote, mi, short, toCheck } from "../lib/ui/model";
import { walkLink } from "../lib/ui/useUiWalk";
import { type Walk, useWalk } from "../lib/walk";
import { AskResult } from "../components/AskResult";
import { tel, useUi } from "../components/ui/bits";
import { useShare } from "../components/ui/ShareSheet";
import { WalkMap, WalkMapProvider, usePhone, useWalkMapCtl } from "../components/ui/WcMap";

/** A link to /check for a home. */
export function checkLink(p: [number, number], addr: string) {
  return walkLink(p, addr).replace(/^\/walk/, "/check");
}

/** The email to Public Works. In English: City staff read it. */
function cityMail(addr: string, c: UiCheck) {
  const list = c.crossings.map((x, i) => `${i + 1}. ${x.kind === "rail" ? `Train tracks (${x.name})` : x.name}${x.control.has ? "" : " - no traffic light or rail crossing within 800 ft"}`);
  const body = [
    `Home: ${addr}`,
    `School: ${c.school.name}, ${c.school.address}`,
    "",
    list.length ? "The walk crosses:" : "",
    ...list,
    "",
    "Please review this walk for a school zone, crossing guard or crosswalk.",
    `${location.origin}${location.pathname}#${checkLink(c.home, addr)}`,
  ].filter((l, i, a) => l || a[i - 1]).join("\n");
  return `mailto:${HPW_EMAIL}?subject=${encodeURIComponent(`School walk: ${short(c.school.name)}`)}&body=${encodeURIComponent(body)}`;
}

function Danger({ c, i }: { c: UiCrossing; i: number }) {
  const { L } = useUi();
  const ctl = useWalkMapCtl();
  return (
    <li>
      <button type="button" className={`danger${c.control.has ? "" : " is-bad"}`} onClick={() => ctl.current?.show(i)}>
        <span className="n">{i + 1}</span>
        <b>{c.kind === "rail" ? L.rail_name : c.name}</b>
        <span>{dangerNote(c, L)}</span>
      </button>
    </li>
  );
}

export default function Check() {
  const d = useData();
  const w = useWalk();
  const c = useMemo(() => (w ? toCheck(d, w) : null), [d, w]);
  if (!w) return <Navigate to="/" replace />;
  if (!c) return <Navigate to={`/nozone?${new URLSearchParams({ addr: w.addr })}`} replace />;
  return (
    <WalkMapProvider>
      <CheckBody w={w} c={c} />
    </WalkMapProvider>
  );
}

function CheckBody({ w, c }: { w: Walk; c: UiCheck }) {
  const { L } = useUi();
  const share = useShare();
  const phone = usePhone();
  const q = walkLink(w.home, w.addr).split("?")[1];
  const v = { red: [L.v_red, L.v_red_s], yellow: [L.v_yellow, L.v_yellow_s], green: [L.v_green, L.v_green_s] }[c.verdict];
  const link = `${location.origin}${location.pathname}#${checkLink(w.home, w.addr)}`;
  const msg = `${w.addr} → ${c.school.name}: ${v[0]}. ${c.crossings.map((x) => (x.kind === "rail" ? L.rail_name : x.name)).join(", ")} ${link}`;

  return (
    <section className="screen check">
      <AskResult w={w} bus={c.closed ? `/bus?${q}` : undefined} />
      <p className="addrline">{w.addr} <Link to="/">×</Link></p>
      <div className={`verdict ${c.verdict}`} role="status">
        <b>{v[0]}</b>
        <span>{v[1]}</span>
      </div>
      <p className="school"><span>{L.your_school}</span><b>{c.school.name}</b><span>{mi(c.distM)} mi</span></p>

      <WalkMap c={c} height={phone ? 320 : 460} />

      <h2>{L.dangers}</h2>
      {c.crossings.length ? <ol className="dangers">{c.crossings.map((x, i) => <Danger key={x.key} c={x} i={i} />)}</ol> : <p className="muted">{L.none}</p>}

      <h2>{L.contacts}</h2>
      <div className="contacts">
        <a className="btn" href={tel(HISD_LINE)}>{L.call_hisd} · {HISD_LINE}</a>
        <a className="btn secondary" href={cityMail(w.addr, c)}>{L.email_city}</a>
        <a className="btn secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.school.name}, ${c.school.address}, Houston, TX`)}`} target="_blank" rel="noopener">
          {L.school_office} · {c.school.address}
        </a>
      </div>
      {c.closed && (
        <p className="shuttle">
          {L.shuttle_line(c.closed.name)} · <Link to={`/bus?${q}`}>{L.askbus} ›</Link>
        </p>
      )}
      <p className="more">
        {c.closed && <Link to={`/walk?${q}`}>{L.details} ›</Link>}
        <button type="button" className="linkbtn" onClick={() => share(msg, L.share_h)}>{L.share}</button>
      </p>
    </section>
  );
}
