// AI_MOCK=1: canned replies built from the same inputs, so the page, the checks and the tests run with no API key.
// Every mock reply says it's a demo.
import type { AiLang, AiMode, WalkGrounding } from "../../src/lib/ai/types";

const DEMO: Record<AiLang, string> = { en: "Demo answer (no AI key set): ", es: "Respuesta de prueba (sin clave de IA): " };

export function mockReply(mode: AiMode, lang: AiLang, ctx: WalkGrounding | undefined, lastUser: string, staff?: { firstId: string; school?: string; firstStreet?: string }): string {
  switch (mode) {
    case "explain": {
      const first = ctx?.walkToSchool.crossings[0];
      return `${DEMO[lang]}${ctx?.headline ?? ""}${first ? ` ${first.whereToCross}` : ""}`;
    }
    case "walkway":
      return lastUser.trim().split(/\s+/).length < 4
        ? `ASK: ${lang === "es" ? "¿Qué ve en el camino? ¿Hay banqueta, dónde cruzan y cómo es el tráfico?" : "What do you see on the walk? Is there a sidewalk, where do you cross, and what is the traffic like?"}`
        : `DRAFT: Demo draft (no AI key set). In our words: "${lastUser.trim().replace(/\s+/g, " ").slice(0, 200)}"`;
    case "staff":
      return `Demo answer (no AI key set). The first corridor in the data is ${staff?.firstId ?? "unknown"} [${staff?.firstId ?? "unknown"}].`;
    case "narrative":
      return `Demo draft (no AI key set). Students from our former zone now walk to ${staff?.school ?? "our school"} and cross ${staff?.firstStreet ?? "the streets listed"}.\n\nOur own count of students walking across these streets: ____`;
  }
}
