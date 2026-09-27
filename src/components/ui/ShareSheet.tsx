// The share sheet: the message, then Send (the phone's share sheet or a text on a phone, email on a computer) and Copy.
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShareIcon, isPhone, useUi } from "./bits";

type Open = (text: string, title: string) => void;
const ShareCtx = createContext<Open>(() => {});
export const useShare = () => useContext(ShareCtx);

export function ShareProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; title: string } | null>(null);
  const open = useCallback<Open>((text, title) => setMsg({ text, title }), []);
  return (
    <ShareCtx.Provider value={open}>
      {children}
      {msg && <Sheet text={msg.text} title={msg.title} onClose={() => setMsg(null)} />}
    </ShareCtx.Provider>
  );
}

function Sheet({ text, title, onClose }: { text: string; title: string; onClose: () => void }) {
  const { L } = useUi();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const send = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setShown(false);
    setTimeout(onClose, 420);
  }, [onClose]);
  useEffect(() => {
    requestAnimationFrame(() => {
      setShown(true);
      send.current?.focus();
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [close]);
  const phone = isPhone();
  const url = /https?:\/\/\S+/.exec(text)?.[0];
  const shortUrl = url ? `${url.replace(/^https?:\/\//, "").replace(/[?#].*$/, "")}/walk…` : "";
  const body = url ? text.split(url) : [text];
  function onSend() {
    if (phone) {
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else location.href = `sms:?&body=${encodeURIComponent(text)}`;
    } else location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  }
  const root = document.getElementById("sheet-root") ?? document.body;
  return createPortal(
    <>
      <div className={`scrim${shown ? " is-in" : ""}`} onClick={close} />
      <div className={`sheet${shown ? " is-in" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <i className="grab" />
        <div className="sheet-hd">
          <h2>{title}</h2>
          <button type="button" className="x" aria-label={L.close} onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <span className="k">{L.your_msg}</span>
        <div className="msg"><p>{body[0]}{url && <u>{shortUrl}</u>}{body[1]}</p></div>
        <p className="small muted">{phone ? L.opens_msgs : L.opens_mail}</p>
        <div className="sheet-btns">
          <button type="button" className="btn" ref={send} onClick={onSend}><ShareIcon /><span>{L.share}</span></button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
          >
            {copied ? L.copied : L.copy}
          </button>
        </div>
      </div>
    </>,
    root,
  );
}
