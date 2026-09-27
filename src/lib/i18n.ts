// The language switch and the strings outside the Walk Check screens (the page for HISD's form, the AI panels), in
// English and Spanish. The screens' own strings are in src/lib/ui/strings.ts, under the same rules.
//
// Copy rules, enforced here rather than left to taste:
//   1. Neither side's voice. The page isn't HISD smoothing over the closures, and it isn't a protest against
//      them: "HISD's own rules, checked against your street." No "unfair," no "transition," no blame, no thanks.
//   2. Never say a family qualifies. The page gathers evidence; HISD decides.
//   3. Plain words, about a 6th-grade reading level. The answer first, detail after, legal cites inside <details>.
//   4. Never "safe" (nor "seguro/segura"). A light is "a traffic light," a rail crossing "has gates." Lead with where
//      to cross; crash and death counts stay inside <details>. Written for the adult who walks the child.
// The staff pages (closed zones data, corridors, Before April 15) stay in English; they say so in Spanish.
// The packet body stays in English because HISD staff read it; its instructions to the family are translated.
// The Spanish hasn't been reviewed by a professional translator, and the app says so whenever it's shown.

import { createContext, useContext } from "react";

export type Lang = "en" | "es";

const en = {
  htmlLang: "en",
  loading: "Loading maps…",
  unreviewed: "",

  packet: {
    back: "← Back",
    print: "Print / PDF",
    howTitle: "Send to HISD",
    howIntro: "",
    way1Title: "1. Online",
    way1Before: "Open HISD's ",
    way1Link: "Transportation Support Request Form",
    way1After: '. Pick "Walk Route Concerns." Paste the text below. Needs the student ID (S + 7 numbers). Also print this for the office.',
    way2Title: "2. Through the school",
    way2: (school: string) => `Give a copy to the principal of ${school}. HISD policy CNA, Exhibit B: the principal starts the request.`,
    timing: "HISD: 5–10 business days for transportation requests. HISD decides.",
    copyTitle: "Text for the form",
    copyNote: "",
    addSidewalk: "Add one line: is there a sidewalk, and where does your child cross?",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Select and copy the text.",
    printNote: "",
  },

  ai: {
    notice: "AI assistant (Claude), not HISD or the City. Can be wrong. Nothing is saved. Don't type your child's name.",
    demo: "Demo mode: canned answers.",
    askTitle: "Ask about this walk",
    askIntro: "",
    start: "Ask",
    suggestions: ["Where should we cross?", "Which crossing is worst?", "Who do I call?", "Does Pre-K get a bus?"],
    placeholder: "Your question",
    send: "Ask",
    you: "You",
    bot: "AI",
    thinking: "Thinking…",
    error: "No answer right now. Try again.",
    done: "Chat ended. Reload to start over.",
    walkwayLink: "Describe the sidewalk for HISD",
    walkwayTitle: "Describe the walk",
    walkwayIntro: "No public sidewalk map exists. Your words are the evidence. Any language; you get one English sentence.",
    walkwayLabel: "What is the walk like?",
    walkwayPlaceholder: "No sidewalk on Lyons. Kids walk in the street.",
    walkwayWrite: "Write it for HISD",
    walkwayYours: "Your words",
    walkwayDraft: "For HISD (English)",
    walkwayCheck: "Check it. You can edit it.",
    walkwayUse: "Use this",
    walkwayUsed: "Added to the request and the form text.",
    walkwayRemove: "Remove",
    walkwayAgain: "Again",
  },
};

export type Dict = typeof en;

const es: Dict = {
  htmlLang: "es",
  loading: "Cargando mapas…",
  unreviewed: "Traducción sin revisión profesional.",

  packet: {
    back: "← Atrás",
    print: "Imprimir / PDF",
    howTitle: "Enviar a HISD",
    howIntro: "",
    way1Title: "1. En línea",
    way1Before: "Abra el ",
    way1Link: "formulario de transporte de HISD (Transportation Support Request Form)",
    way1After: '. Elija "Walk Route Concerns." Pegue el texto de abajo. Necesita el número de estudiante (S + 7 números). Imprima esto también para la oficina.',
    way2Title: "2. Por la escuela",
    way2: (school: string) => `Entregue una copia al director de ${school}. Política CNA, Anexo B: el director inicia la solicitud.`,
    timing: "HISD: 5–10 días hábiles para transporte. HISD decide.",
    copyTitle: "Texto para el formulario",
    copyNote: "En inglés: lo lee HISD.",
    addSidewalk: "Agregue una línea: ¿hay banqueta y dónde cruza su hijo? Puede ser en español.",
    copy: "Copiar",
    copied: "Copiado",
    copyFailed: "Seleccione y copie el texto.",
    printNote: "Impreso en inglés: lo lee HISD.",
  },

  ai: {
    notice: "Asistente de IA (Claude), no HISD ni la Ciudad. Puede equivocarse. No se guarda nada. No escriba el nombre de su hijo.",
    demo: "Modo de prueba: respuestas fijas.",
    askTitle: "Pregunte sobre este camino",
    askIntro: "",
    start: "Preguntar",
    suggestions: ["¿Dónde cruzamos?", "¿Cuál cruce es el peor?", "¿A quién llamo?", "¿Pre-K tiene autobús?"],
    placeholder: "Su pregunta",
    send: "Preguntar",
    you: "Usted",
    bot: "IA",
    thinking: "Pensando…",
    error: "Sin respuesta ahora. Intente otra vez.",
    done: "Fin de la conversación. Recargue para empezar otra.",
    walkwayLink: "Describir la banqueta para HISD",
    walkwayTitle: "Describa el camino",
    walkwayIntro: "No hay mapa público de banquetas. Sus palabras son la evidencia. Cualquier idioma; recibe una oración en inglés.",
    walkwayLabel: "¿Cómo es el camino?",
    walkwayPlaceholder: "No hay banqueta en Lyons. Los niños caminan en la calle.",
    walkwayWrite: "Escribirlo para HISD",
    walkwayYours: "Sus palabras",
    walkwayDraft: "Para HISD (inglés)",
    walkwayCheck: "Revísela. Puede editarla.",
    walkwayUse: "Usar",
    walkwayUsed: "Agregada a la solicitud y al texto del formulario.",
    walkwayRemove: "Quitar",
    walkwayAgain: "Otra vez",
  },
};

export const DICTS: Record<Lang, Dict> = { en, es };

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function useT() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: DICTS[lang] };
}

/** ?lang=es before or after the # both work, so a flyer link or QR code can open the page in Spanish. */
export function initialLang(): Lang {
  const inHash = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("lang");
  const q = new URLSearchParams(window.location.search).get("lang") ?? inHash;
  if (q === "es" || q === "en") return q;
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* storage blocked: fall through */
  }
  // First visit: follow the phone's language.
  return (navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
}

/** Keep the choice in the URL (outside the hash, which the router owns) and, where allowed, in storage. */
export function persistLang(lang: Lang) {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* storage blocked: the URL still carries it */
  }
  const u = new URL(window.location.href);
  if (lang === "es") u.searchParams.set("lang", "es");
  else u.searchParams.delete("lang");
  window.history.replaceState(window.history.state, "", u);
}
