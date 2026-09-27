// The chat about one home's walk (idea #1), grounded on what the page already worked out, behind the fixed ASK button.
// The walkway helper's entry point (idea #3) sits under the chat, since the sidewalk is the question the page can't answer.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAiStatus } from "../lib/ai/client";
import { walkGrounding } from "../lib/ai/grounding";
import { useData } from "../lib/data";
import { useT } from "../lib/i18n";
import type { Walk } from "../lib/walk";
import { AskSheet } from "./AskSheet";
import { useUi } from "./ui/bits";

/** `bus`: the bus-request screen for this home, where the walkway helper lives. Only closed-zone homes have one. */
export function AskResult({ w, bus }: { w: Walk; bus?: string }) {
  const d = useData();
  const { lang, t } = useT();
  const { L } = useUi();
  const ai = useAiStatus();
  const context = useMemo(() => walkGrounding(d, w, lang), [d, w, lang]);
  if (!ai.available || !context) return null;
  return (
    <AskSheet
      key={lang}
      label={L.ask}
      mode="explain"
      title={t.ai.askTitle}
      intro=""
      suggestions={t.ai.suggestions}
      context={context}
      mock={ai.mock}
      extra={bus && <Link className="linkbtn" to={bus} state={{ walkway: true }}>{t.ai.walkwayLink} ›</Link>}
    />
  );
}
