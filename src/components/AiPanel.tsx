// The AI chat box, shared by the family's result (#1) and the staff pages (#6). The "this is AI" notice sits above the
// box before anyone types (Texas HB 149 §552.051 asks a government's AI to say so up front; we say it either way).
// Nothing here is saved: the conversation lives in this component and is gone on reload.
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { askAI } from "../lib/ai/client";
import { type AiMode, type AiTurn, LIMITS, type WalkGrounding } from "../lib/ai/types";
import { useT } from "../lib/i18n";

export interface AiPanelProps {
  mode: Extract<AiMode, "explain" | "staff">;
  title: string;
  intro: string;
  suggestions: string[];
  /** explain: the page's own result for this home. */
  context?: WalkGrounding;
  /** Overrides the family notice (staff pages). */
  notice?: string;
  /** Staff answers carry [ids]; render each one (a chip that selects the row, say). */
  renderCite?: (id: string) => ReactNode;
  /** Shown when the proxy runs without a key. */
  mock?: boolean;
}

/** Answer text with [ids] turned into whatever the page renders for them. */
export function AnswerText({ text, renderCite }: { text: string; renderCite?: (id: string) => ReactNode }) {
  if (!renderCite) return <>{text}</>;
  const parts = text.split(/\[([^\]\n]{1,80})\]/g);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i}>{renderCite(p.trim())}</span> : p))}</>;
}

export function AiPanel({ mode, title, intro, suggestions, context, notice, renderCite, mock }: AiPanelProps) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const done = turns.length >= LIMITS.maxTurns - 1;

  async function ask(q: string) {
    const text = q.trim().slice(0, LIMITS.maxMessageChars);
    if (!text || busy || done) return;
    const next: AiTurn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(false);
    const res = await askAI({ mode, lang, context, messages: next });
    setBusy(false);
    if (res.ok) setTurns([...next, { role: "assistant", text: res.text }]);
    else {
      // Take the question back out so the turns still alternate, and leave it in the box to send again.
      setTurns(turns);
      setDraft(text);
      setError(true);
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  if (!open)
    return (
      <div className="card ai-card no-print">
        <span className="v">{title}</span>
        <span className="muted">{intro}</span>
        <button type="button" className="btn secondary" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>
          {t.ai.start}
        </button>
      </div>
    );

  return (
    <section className="card ai-card is-open no-print" aria-label={title}>
      <span className="v">{title}</span>
      <p className="ai-notice" role="note">{notice ?? t.ai.notice}</p>
      {mock && <p className="small muted">{t.ai.demo}</p>}
      <div className="ai-log" aria-live="polite">
        {turns.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <span className="k">{m.role === "user" ? t.ai.you : t.ai.bot}</span>
            <p>{m.role === "assistant" ? <AnswerText text={m.text} renderCite={renderCite} /> : m.text}</p>
          </div>
        ))}
        {busy && <p className="muted ai-busy">{t.ai.thinking}</p>}
        {error && <p className="error">{t.ai.error}</p>}
      </div>
      {turns.length === 0 && (
        <div className="chips">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" disabled={busy} onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}
      {done ? (
        <p className="small muted">{t.ai.done}</p>
      ) : (
        <form className="ai-form" onSubmit={submit}>
          <textarea
            ref={input}
            className="input"
            rows={2}
            maxLength={LIMITS.maxMessageChars}
            placeholder={t.ai.placeholder}
            aria-label={t.ai.placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
          />
          <button type="submit" className="btn" disabled={busy || !draft.trim()}>{t.ai.send}</button>
        </form>
      )}
    </section>
  );
}
