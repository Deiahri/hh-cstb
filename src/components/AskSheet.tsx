// The chat, always one tap away: a fixed ASK button (a bar along the bottom on phones, a block bottom-right on desktop)
// that opens the chat in a sheet. The panel stays mounted once opened, so closing the sheet keeps the conversation.
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AiPanel, type AiPanelProps } from "./AiPanel";
import { useUi } from "./ui/bits";

export function AskSheet({ label, extra, ...panel }: AiPanelProps & { label: string; extra?: ReactNode }) {
  const { L } = useUi();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.add("has-ask");
    return () => document.body.classList.remove("has-ask");
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open]);
  const root = document.getElementById("sheet-root");
  return (
    <>
      <button type="button" className="askfab no-print" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMounted(true); setOpen(true); }}>
        {label}
      </button>
      {mounted && root && createPortal(
        <>
          <div className={`scrim${open ? " is-in" : ""}`} hidden={!open} onClick={() => setOpen(false)} />
          <div className={`asksheet${open ? " is-in" : ""}`} role="dialog" aria-modal="true" aria-label={panel.title} hidden={!open}>
            <div className="asksheet-hd">
              <b>{panel.title}</b>
              <button type="button" className="asksheet-x" aria-label={L.close} onClick={() => setOpen(false)}>×</button>
            </div>
            <AiPanel {...panel} startOpen />
            {extra}
          </div>
        </>,
        root,
      )}
    </>
  );
}
