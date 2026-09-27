// Idea #1 on the answer screen: ask about this result, grounded on what the page already worked out. Idea #3's entry
// point sits under it, since the sidewalk is the question the page can't answer on its own.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAiStatus } from "../lib/ai/client";
import { walkGrounding } from "../lib/ai/grounding";
import { useData } from "../lib/data";
import { useT } from "../lib/i18n";
import type { Walk } from "../lib/walk";
import { AiPanel } from "./AiPanel";

/** `bus`: the bus-request screen for this home, where the walkway helper lives. Only closed-zone homes have one. */
export function AskResult({ w, bus }: { w: Walk; bus?: string }) {
  const d = useData();
  const { lang, t } = useT();
  const ai = useAiStatus();
  const context = useMemo(() => walkGrounding(d, w, lang), [d, w, lang]);
  if (!ai.available || !context) return null;
  return (
    <>
      <AiPanel key={lang} mode="explain" title={t.ai.askTitle} intro={t.ai.askIntro} suggestions={t.ai.suggestions} context={context} mock={ai.mock} />
      {bus && <Link className="linkbtn no-print" to={bus} state={{ walkway: true }}>{t.ai.walkwayLink} ›</Link>}
    </>
  );
}
