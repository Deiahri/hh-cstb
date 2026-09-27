// Shared pieces of the Walk Check screens: the logo, the splash, the back link, the walk strip and the share sheet.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Hazard } from "../lib/analyze";
import { useT } from "../lib/i18n";

/**
 * The mark: a road from home (amber dot) to school (ring). Drawn inline rather than through <use>, so the page's CSS
 * (colors, the splash's draw-in) reaches its parts.
 */
export const Logo = ({ size = 28, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
    <rect width="100" height="100" rx="22" className="logo-bg" />
    <path className="logo-road" d="M22 54 L42 74 L78 30" fill="none" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    <path className="logo-dash" d="M22 54 L42 74 L78 30" fill="none" strokeWidth="3" strokeDasharray="6 7" />
    <circle className="logo-home" cx="22" cy="54" r="10" strokeWidth="3" />
    <circle className="logo-school" cx="78" cy="30" r="11" strokeWidth="5" />
  </svg>
);

/** Shown once per browser session while the data loads, then fades. */
export function Splash({ ready }: { ready: boolean }) {
  const [show] = useState(() => {
    try {
      if (sessionStorage.getItem("wc.splash")) return false;
      sessionStorage.setItem("wc.splash", "1");
    } catch {
      /* storage blocked: show it every time, it's short */
    }
    return true;
  });
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setMinDone(true), 1100);
    return () => clearTimeout(t);
  }, [show]);
  useEffect(() => {
    if (!show || !ready || !minDone) return;
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [show, ready, minDone]);
  if (!show || gone) return null;
  return (
    <div className={`splash on-green${ready && minDone ? " is-gone" : ""}`} aria-hidden="true">
      <Logo size={120} />
      <div className="splash-word">Walk Check</div>
    </div>
  );
}

export function Back({ to }: { to?: string }) {
  const { t } = useT();
  const nav = useNavigate();
  return (
    <button type="button" className="back no-print" onClick={() => (to ? nav(to) : window.history.length > 1 ? nav(-1) : nav("/"))}>
      ‹ {t.wc.back}
    </button>
  );
}

/** Home → each road (amber) or track (ink) → school, in the order the straight line meets them. Draws itself once. */
export function RouteStrip({ hazards, school }: { hazards: Hazard[]; school: string }) {
  const { t } = useT();
  const ref = useRef<SVGLineElement>(null);
  const short = (s: string) => s.replace(/\s+(St|Rd|Dr|Blvd|Ave|Ln|Street|Road|Drive)$/i, "");
  const steps = [
    { l: t.wc.home1, k: null as null | "road" | "rail" },
    ...hazards.map((h) => ({ l: h.kind === "rail" ? (t.hazard.rail.split(" (")[0]) : short(h.name), k: h.kind })),
    { l: school.replace(/ ES$/, ""), k: null },
  ];
  const W = 340, x0 = 18, x1 = W - 18, y = 22, gap = (x1 - x0) / (steps.length - 1);
  // Labels crowd past four stops: alternate them above and below the line.
  const stagger = steps.length > 4;
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) { el?.setAttribute("stroke-dashoffset", "0"); return; }
    el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 900, delay: 150, easing: "cubic-bezier(0.23,1,0.32,1)", fill: "forwards" });
  }, [hazards.length]);
  return (
    <svg className="route-svg" viewBox={`0 ${stagger ? -26 : 0} ${W} ${stagger ? 86 : 60}`} role="img"
      aria-label={t.wc.walkAria(steps.map((s) => s.l).join(" → "))}>
      <line className="route-line" x1={x0} y1={y} x2={x1} y2={y} />
      <line ref={ref} className="route-draw" x1={x0} y1={y} x2={x1} y2={y} pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
      {steps.map((s, i) => {
        const x = x0 + i * gap;
        const up = stagger && i % 2 === 1;
        return (
          <g key={i}>
            {s.k
              ? <rect x={x - 9} y={y - 9} width={18} height={18} rx={s.k === "rail" ? 2 : 4} className={s.k === "rail" ? "route-rail" : "route-road"} />
              : <circle cx={x} cy={y} r={9} className="route-home" />}
            <text className={`route-label${s.k ? " b" : ""}`} x={x} y={up ? y - 16 : y + 28}
              textAnchor={i === 0 ? "start" : i === steps.length - 1 ? "end" : "middle"}>{s.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

const isPhone = () => matchMedia("(max-width: 899px)").matches;

/**
 * The share sheet: shows the message, then hands it to the phone's share menu or Messages (sms:), or to the mail app
 * on a computer (mailto:). No number or address is collected.
 */
export function ShareSheet({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    btn.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => { setOpen(false); setTimeout(onClose, 300); };
  const send = () => {
    if (isPhone()) {
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    } else window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  };
  return (
    <>
      <div className={`scrim${open ? " is-in" : ""}`} onClick={close} />
      <div className={`sheet${open ? " is-in" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <i className="grab" />
        <h2>{title}</h2>
        <div className="msg"><span className="k">{t.wc.yourMsg}</span><p>{text}</p></div>
        <button ref={btn} type="button" className="btn" onClick={send}>{t.wc.send}</button>
        <button type="button" className="linkbtn" onClick={close}>{t.wc.close}</button>
      </div>
    </>
  );
}

/** A share button and its sheet. */
export function ShareButton({ title, text, label, primary = false }: { title: string; text: string; label: ReactNode; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn${primary ? "" : " secondary"}`} onClick={() => setOpen(true)}>{label}</button>
      {open && <ShareSheet title={title} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Before → now bars for one row: gray for the walk before the closures, amber for now. Values are percentages. */
export function BarRow({ label, sub, before, now, href }: { label: string; sub?: string; before: number; now: number; href?: string }) {
  const body = (
    <>
      <div className="hd"><b>{label}</b>{sub && <span>{sub}</span>}</div>
      <div className="tr"><i className="fill" style={{ ["--v" as string]: before }} /><span>{Math.round(before)}%</span></div>
      <div className="tr now"><i className="fill now" style={{ ["--v" as string]: now }} /><span>{Math.round(now)}%</span></div>
    </>
  );
  return href ? <Link className="bar" to={href}>{body}</Link> : <div className="bar">{body}</div>;
}

export function BarLegend() {
  const { t } = useT();
  return <div className="bar-legend"><span><i />{t.wc.before}</span><span><i className="now" />{t.wc.after}</span></div>;
}
