// The small shared pieces of the Walk Check screens, as the static build drew them (ui/app.js): back link, numbered
// steps, the action bar, bars, the "give it to" card, the scaled paper preview and the print root.
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useT } from "../../lib/i18n";
import { HISD_LINE } from "../../lib/ui/contacts";
import { UI, type UiDict } from "../../lib/ui/strings";

/** The current language and its dictionary. */
export function useUi(): { lang: "en" | "es"; L: UiDict; setLang: (l: "en" | "es") => void } {
  const { lang, setLang } = useT();
  return { lang, L: UI[lang], setLang };
}

export const isPhone = () => matchMedia("(max-width:899px)").matches;
export const reduced = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
export const tel = (n: string) => `tel:${n.replace(/\D/g, "")}`;

export function Back() {
  const { L } = useUi();
  const nav = useNavigate();
  return <button type="button" className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))}>‹ {L.back}</button>;
}

export function Steps({ list, h }: { list: string[]; h?: string }) {
  return (
    <div className="steps">
      {h && <h2>{h}</h2>}
      <ol>{list.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  );
}

export const Arrow = () => (
  <svg className="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
  </svg>
);
const PrintIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" />
  </svg>
);
export const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export interface BarButton { label: string; onClick: () => void; primary?: boolean; icon?: "print" | "share" }
/** The fixed bar on phones (and the button stack beside the map on desktop): secondary buttons in a row, then the primary. */
export function ActionBar({ btns }: { btns: BarButton[] }) {
  const p = btns.find((b) => b.primary), sec = btns.filter((b) => !b.primary);
  return (
    <div className="bar-fixed">
      <div className="bar-row">
        {sec.map((b) => (
          <button key={b.label} type="button" className="btn small secondary" onClick={b.onClick}>
            {b.icon === "share" ? <ShareIcon /> : b.icon === "print" ? <PrintIcon /> : null}<span>{b.label}</span>
          </button>
        ))}
      </div>
      {p && <button type="button" className="btn primary" onClick={p.onClick}>{p.label}</button>}
    </div>
  );
}

export function BarRow({ label, sub, before, now, onClick }: { label: string; sub?: string; before: number; now: number; onClick?: () => void }) {
  const inner = (
    <>
      <div className="hd"><b>{label}</b>{sub && <span>{sub}</span>}</div>
      <div className="tr"><i className="fill" style={{ ["--v" as string]: before }} /><span>{Math.round(before)}%</span></div>
      <div className="tr now"><i className="fill now" style={{ ["--v" as string]: now }} /><span>{Math.round(now)}%</span></div>
    </>
  );
  return onClick ? <a className="bar" href="#" onClick={(e) => { e.preventDefault(); onClick(); }}>{inner}</a> : <div className="bar">{inner}</div>;
}

export function Legend() {
  const { L } = useUi();
  return <div className="legend"><span><i />{L.lb}</span><span><i className="now" />{L.ln}</span></div>;
}

/** Who the request goes to. Principals are named by school only: the static build's names and phones had no source. */
export function WhoCard({ school, address }: { school: string; address: string }) {
  const { L } = useUi();
  return (
    <dl className="def">
      <dt>{L.give}</dt>
      <dd><b>{L.principal_of(school)}</b><br />{school} · {address}<br /><span className="muted">{L.front}</span></dd>
      <dt>{L.hisd_line}</dt>
      <dd><a href={tel(HISD_LINE)}>{HISD_LINE}</a></dd>
    </dl>
  );
}

/** A letter-size document shown scaled to its column, as the page the school will get. */
export function Paper({ children, pages }: { children: ReactNode; pages?: string }) {
  const { lang, L } = useUi();
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const s = (el.clientWidth - 4) / 612;
      el.style.setProperty("--s", String(s));
      el.style.height = `${792 * s + 4}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <figure className="paper" ref={ref}>
      <div className="paper-scale">{children}</div>
      <figcaption className="small muted">
        {L.preview}{pages ? ` · ${pages}` : ""}
        {lang === "es" && <><br />{L.doc_en}</>}
      </figcaption>
    </figure>
  );
}

/** What prints: the document for the current screen, rendered into #print-root, which is all the print stylesheet shows. */
export function PrintDoc({ children }: { children: ReactNode }) {
  const root = document.getElementById("print-root");
  return root ? createPortal(children, root) : null;
}
