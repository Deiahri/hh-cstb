// Idea #3: the family describes the walk in their own words and language; the assistant drafts one English sentence
// for the Description box of HISD's form. Their words and the draft sit side by side, and nothing reaches the copy box
// or the printed request until they tap "Use this sentence". The family pastes and submits; this submits nothing.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { askAI, useAiStatus } from "../lib/ai/client";
import { walkGrounding } from "../lib/ai/grounding";
import { type AiTurn, LIMITS } from "../lib/ai/types";
import { useData } from "../lib/data";
import { useT } from "../lib/i18n";
import { useWalk } from "../lib/walk";
import { useWalkway } from "../lib/ai/walkway";

export function WalkwayHelper() {
  const d = useData();
  const w = useWalk();
  const [used, onUse] = useWalkway(w ? `${w.home[0]},${w.home[1]}` : "");
  const { lang, t } = useT();
  const ai = useAiStatus();
  const context = useMemo(() => (w ? walkGrounding(d, w, lang) : null), [d, w, lang]);
  const [words, setWords] = useState("");
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [result, setResult] = useState<{ kind: "draft" | "ask"; text: string } | null>(null);
  const [edited, setEdited] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const box = useRef<HTMLElement>(null);
  const cameForIt = (useLocation().state as { walkway?: boolean } | null)?.walkway;
  useEffect(() => {
    if (cameForIt && ai.available) box.current?.scrollIntoView({ block: "start" });
  }, [cameForIt, ai.available]);

  if (!ai.available || !context) return null;
  const all = [...turns.filter((m) => m.role === "user").map((m) => m.text)].join(" · ");

  async function write() {
    const text = words.trim().slice(0, LIMITS.maxMessageChars);
    if (!text || busy || turns.length >= LIMITS.maxTurns - 1) return;
    const next: AiTurn[] = [...turns, { role: "user", text }];
    setBusy(true);
    setError(false);
    const res = await askAI({ mode: "walkway", lang, context: context!, messages: next });
    setBusy(false);
    if (!res.ok) return setError(true);
    setTurns([...next, { role: "assistant", text: res.text }]);
    setWords("");
    const kind = res.kind ?? "draft";
    setResult({ kind, text: res.text });
    if (kind === "draft") setEdited(res.text);
  }

  return (
    <section className="card ai-card is-open walkway no-print" ref={box} aria-label={t.ai.walkwayTitle}>
      <span className="v">{t.ai.walkwayTitle}</span>
      <p className="ai-notice" role="note">{t.ai.notice}</p>
      {ai.mock && <p className="small muted">{t.ai.demo}</p>}
      <p>{t.ai.walkwayIntro}</p>

      {used ? (
        <>
          <p className="walkway-used" lang="en">{used}</p>
          <p className="small">{t.ai.walkwayUsed}</p>
          <button type="button" className="linkbtn" onClick={() => onUse(null)}>{t.ai.walkwayRemove}</button>
        </>
      ) : (
        <>
          {result?.kind === "draft" && (
            <div className="walkway-cmp">
              <div>
                <span className="k">{t.ai.walkwayYours}</span>
                <p>{all}</p>
              </div>
              <div>
                <label className="k" htmlFor="walkway-draft">{t.ai.walkwayDraft}</label>
                <textarea id="walkway-draft" className="input" lang="en" rows={4} value={edited} onChange={(e) => setEdited(e.target.value)} />
                <span className="small muted">{t.ai.walkwayCheck}</span>
              </div>
            </div>
          )}
          {result?.kind === "draft" && (
            <button type="button" className="btn" disabled={!edited.trim()} onClick={() => onUse(edited.trim())}>{t.ai.walkwayUse}</button>
          )}
          {result?.kind === "ask" && <p className="ai-msg assistant"><span className="k">{t.ai.bot}</span> {result.text}</p>}

          <label className="k" htmlFor="walkway-words">{t.ai.walkwayLabel}</label>
          <textarea
            id="walkway-words"
            className="input"
            rows={3}
            maxLength={LIMITS.maxMessageChars}
            placeholder={t.ai.walkwayPlaceholder}
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
          <button type="button" className={`btn${result?.kind === "draft" ? " secondary" : ""}`} disabled={busy || !words.trim()} onClick={write}>
            {busy ? t.ai.thinking : result?.kind === "draft" ? t.ai.walkwayAgain : t.ai.walkwayWrite}
          </button>
          {error && <p className="err">{t.ai.error}</p>}
        </>
      )}
    </section>
  );
}
