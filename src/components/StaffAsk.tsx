// Idea #6: staff questions over the corridor, zone-request and zone data, and a first draft of one school's narrative.
// The proxy reads the data files itself; every number in an answer carries the [id] of its row, and ids that don't
// exist in the data are dropped before the answer arrives here. Staff pages are English only.
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { askAI, useAiStatus } from "../lib/ai/client";
import { useData } from "../lib/data";
import { AiPanel } from "./AiPanel";

const STAFF_NOTICE =
  "This is an AI assistant (Anthropic's Claude). It answers only from this app's corridor, zone-request and zone data, " +
  "puts the row id behind each number in brackets, and can still be wrong: check each figure against the table before " +
  "using it. HPW and HISD decide; this site saves nothing you type.";

/** For a cited id, the action that selects its row on this page, or null when this page has no such row. */
export type PickRow = (id: string) => (() => void) | null;

/** The table row for a cited id, scrolled to and lit for a moment. Rows carry `data-row="<id>"`. */
export function rowPicker(ids: Set<string>): PickRow {
  return (id) => {
    if (!ids.has(id)) return null;
    return () => {
      const tr = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
      if (!tr) return;
      tr.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "center" });
      tr.classList.remove("is-hit");
      void tr.offsetWidth;
      tr.classList.add("is-hit");
    };
  };
}

/** A cited row id, as a chip: a link for a school, a button for a row this page can select, else a label. */
export function useCiteChip(pick?: PickRow) {
  const d = useData();
  return (id: string): ReactNode => {
    const corridor = d.corridors.find((c) => c.key === id);
    const street = !corridor && id.includes("|") ? d.zoneRequests.schools.flatMap((s) => s.streets).find((r) => r.id === id) : undefined;
    const school = /^school:(\d+)$/.exec(id);
    const zone = /^zone:(\d+)$/.exec(id);
    const label = corridor?.name ?? (street ? `${street.name}, ${d.zoneRequests.schools.find((s) => s.nbr === street.nbr)?.name}` : null)
      ?? (school ? d.zoneRequests.schools.find((s) => String(s.nbr) === school[1])?.name : null)
      ?? (zone ? `${d.zones.find((z) => String(z.nbr) === zone[1])?.name} zone` : null) ?? id;
    if (school) return <Link className="cite" to={`/draft/${school[1]}`} title={id}>{label}</Link>;
    if (zone) return <Link className="cite" to={`/zone/${zone[1]}`} title={id}>{label}</Link>;
    const go = pick?.(id);
    if (go) return <button type="button" className="cite" title={id} onClick={go}>{label}</button>;
    return <span className="cite" title={id}>{label}</span>;
  };
}

export function StaffAsk({ suggestions, pick }: { suggestions: string[]; pick?: PickRow }) {
  const ai = useAiStatus();
  const cite = useCiteChip(pick);
  if (!ai.available) return null;
  return (
    <AiPanel
      mode="staff"
      title="Ask the data"
      intro="Questions about these corridors, streets and zones, answered from the app's own numbers with the row behind each one."
      notice={STAFF_NOTICE}
      suggestions={suggestions}
      renderCite={cite}
      mock={ai.mock}
    />
  );
}

/** A first draft of the "reason for request" narrative for one receiving school's HPW application, for the principal to edit. */
export function NarrativeDraft({ nbr }: { nbr: number }) {
  const ai = useAiStatus();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!ai.available) return null;
  async function draft() {
    setBusy(true);
    setError(false);
    const res = await askAI({ mode: "narrative", lang: "en", nbr, messages: [{ role: "user", text: "Draft the narrative." }] });
    setBusy(false);
    if (res.ok) setText(res.text);
    else setError(true);
  }
  return (
    <section className="card ai-card is-open no-print" aria-label="Draft the narrative">
      <span className="v">Draft the narrative (AI)</span>
      <p className="ai-notice" role="note">{STAFF_NOTICE}</p>
      {ai.mock && <p className="small muted">Demo mode: no AI key is set, so the draft is canned.</p>}
      {text === null ? (
        <p className="small muted">A first draft of the reason for the request, written from this school's rows below, for the principal to edit. It isn't added to the printed application.</p>
      ) : (
        <>
          <label className="k" htmlFor="narrative">AI draft: check every number against the table below</label>
          <textarea id="narrative" className="input" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          <button
            type="button"
            className="btn secondary"
            onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? "Copied" : "Copy the draft"}
          </button>
        </>
      )}
      <button type="button" className="btn" disabled={busy} onClick={draft}>{busy ? "Drafting…" : text === null ? "Draft the narrative" : "Draft it again"}</button>
      {error && <p className="err">The assistant isn't answering right now. The draft application below still works.</p>}
    </section>
  );
}
