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
  loading: "Loading HISD and City maps…",
  unreviewed: "",

  packet: {
    back: "← Back to the walk",
    print: "Print or save as PDF",
    howTitle: "How to send this to HISD",
    howIntro: "There are two ways. You can use both.",
    way1Title: "1. File it yourself online",
    way1Before: "Open HISD's ",
    way1Link: "Transportation Support Request Form",
    way1After:
      '. Choose "Walk Route Concerns." Paste the text below into the Description box. You\'ll need your child\'s student ID ' +
      "(an S and 7 numbers). The form can't take files, so also print this page and give it to the school office.",
    way2Title: "2. Ask the school to file it",
    way2: (school: string) =>
      `Give a printed copy to the principal of ${school}. Ask them to send HISD a hazardous-route request for your area. ` +
      `HISD's policy (CNA, Exhibit B) has the principal start that request.`,
    timing:
      "HISD's pages give 5 to 10 business days for transportation requests. They don't say how long a walk-route request takes. " +
      "Only HISD decides who gets a bus.",
    copyTitle: "Text to paste into the form",
    copyNote: "",
    addSidewalk:
      "Before you copy it, add a sentence at the end: is there a sidewalk, and where does your child cross? HISD's rule asks about " +
      "sidewalks, and no public map shows them.",
    copy: "Copy text",
    copied: "Copied",
    copyFailed: "Select the text and copy it.",
    printNote: "",
  },

  // The AI assistant (docs/ai-assistant): the "this is AI" notice, the result explainer and the walkway helper.
  ai: {
    notice:
      "This is an AI assistant (Anthropic's Claude), not a person, HISD or the City. It answers only from this page's result " +
      "and can be wrong, so check anything important with the school or HISD. This site doesn't save what you type. Don't type " +
      "your child's name.",
    demo: "Demo mode: no AI key is set, so the answers are canned.",
    askTitle: "Ask about this result",
    askIntro: "Ask what this page means for your child, in your own words.",
    start: "Ask a question",
    suggestions: ["Why does it say my child crosses these roads?", "Where should we cross?", "What happens when the shuttle ends?", "Does Pre-K get a bus?"],
    placeholder: "Type your question",
    send: "Ask",
    you: "You",
    bot: "Assistant (AI)",
    thinking: "Reading your result…",
    error: "The assistant isn't answering right now. Everything else on this page still works.",
    done: "That's the end of this chat. Reload the page to start a new one.",
    walkwayLink: "Help me describe the sidewalk for HISD",
    walkwayTitle: "Describe the walk in your own words",
    walkwayIntro:
      "HISD's form asks about sidewalks, and Houston has no sidewalk map, so your words are the evidence. Write what you see, " +
      "in any language. The assistant writes it as one English sentence for the form. You check it before it's used.",
    walkwayLabel: "What is the walk like?",
    walkwayPlaceholder: "For example: no sidewalk on Lyons, the kids walk in the street next to the trucks",
    walkwayWrite: "Write it for HISD",
    walkwayYours: "Your words",
    walkwayDraft: "For HISD's form (in English)",
    walkwayCheck: "Check it says only what you said. You can change it.",
    walkwayUse: "Use this sentence",
    walkwayUsed: "Added to the request for the principal and to the text for HISD's online form.",
    walkwayRemove: "Take it out",
    walkwayAgain: "Write it again",
  },
};

export type Dict = typeof en;

const es: Dict = {
  htmlLang: "es",
  loading: "Cargando los mapas de HISD y de la Ciudad…",
  unreviewed: "Traducción del equipo, sin revisión profesional.",

  packet: {
    back: "← Regresar al camino",
    print: "Imprimir o guardar como PDF",
    howTitle: "Cómo enviar esto a HISD",
    howIntro: "Hay dos formas. Puede usar las dos.",
    way1Title: "1. Envíelo usted en línea",
    way1Before: "Abra el ",
    way1Link: "formulario de solicitud de apoyo de transporte de HISD (Transportation Support Request Form)",
    way1After:
      '. Elija "Walk Route Concerns" (preocupaciones sobre la ruta a pie). Pegue el texto de abajo en la casilla Description. ' +
      "Necesita el número de estudiante de su hijo (una S y 7 números). El formulario no acepta archivos, así que también imprima " +
      "esta página y entréguela en la oficina de la escuela.",
    way2Title: "2. Pida a la escuela que lo envíe",
    way2: (school: string) =>
      `Entregue una copia impresa a la dirección de ${school}. Pida que envíen a HISD una solicitud de ruta peligrosa para su área. ` +
      `Según la política de HISD (CNA, Anexo B), esa solicitud la inicia el director o la directora.`,
    timing:
      "Las páginas de HISD dan de 5 a 10 días hábiles para solicitudes de transporte. No dicen cuánto tarda una solicitud sobre la " +
      "ruta a pie. Solo HISD decide quién recibe autobús.",
    copyTitle: "Texto para pegar en el formulario",
    copyNote: "Está en inglés porque lo lee el personal de HISD.",
    addSidewalk:
      "Antes de copiarlo, agregue una frase al final: ¿hay acera (banqueta) y dónde cruza su hijo? La regla de HISD pregunta por " +
      "las aceras, y ningún mapa público las muestra. Puede escribirla en español.",
    copy: "Copiar texto",
    copied: "Copiado",
    copyFailed: "Seleccione el texto y cópielo.",
    printNote: "La página impresa está en inglés porque la lee el personal de HISD.",
  },

  ai: {
    notice:
      "Este es un asistente de IA (Claude, de Anthropic), no una persona, ni HISD ni la Ciudad. Contesta solo con el resultado " +
      "de esta página y se puede equivocar; confirme lo importante con la escuela o con HISD. Este sitio no guarda lo que usted " +
      "escribe. No escriba el nombre de su hijo.",
    demo: "Modo de prueba: no hay clave de IA, así que las respuestas son fijas.",
    askTitle: "Pregunte sobre este resultado",
    askIntro: "Pregunte qué significa esta página para su hijo, con sus propias palabras.",
    start: "Hacer una pregunta",
    suggestions: ["¿Por qué dice que mi hijo cruza estas calles?", "¿Dónde debemos cruzar?", "¿Qué pasa cuando termine el autobús de enlace?", "¿Pre-K tiene autobús?"],
    placeholder: "Escriba su pregunta",
    send: "Preguntar",
    you: "Usted",
    bot: "Asistente (IA)",
    thinking: "Leyendo su resultado…",
    error: "El asistente no contesta ahora. Todo lo demás en esta página sigue funcionando.",
    done: "Aquí termina esta conversación. Vuelva a cargar la página para empezar otra.",
    walkwayLink: "Ayúdeme a describir la banqueta para HISD",
    walkwayTitle: "Describa el camino con sus propias palabras",
    walkwayIntro:
      "El formulario de HISD pregunta por las banquetas, y Houston no tiene un mapa de banquetas, así que sus palabras son la " +
      "evidencia. Escriba lo que ve, en cualquier idioma. El asistente lo escribe en una oración en inglés para el formulario. " +
      "Usted la revisa antes de usarla.",
    walkwayLabel: "¿Cómo es el camino?",
    walkwayPlaceholder: "Por ejemplo: no hay banqueta en Lyons, los niños caminan en la calle junto a los camiones",
    walkwayWrite: "Escribirlo para HISD",
    walkwayYours: "Sus palabras",
    walkwayDraft: "Para el formulario de HISD (en inglés)",
    walkwayCheck: "Revise que diga solo lo que usted dijo. Puede cambiarla.",
    walkwayUse: "Usar esta oración",
    walkwayUsed: "Se agregó a la solicitud para el director y al texto para el formulario en línea de HISD.",
    walkwayRemove: "Quitarla",
    walkwayAgain: "Escribirla otra vez",
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
