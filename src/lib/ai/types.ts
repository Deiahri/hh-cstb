// The one contract between the page and the AI proxy (server/ai.ts). Plain types and limits only, so the
// Worker can import this file without pulling in React.

export type AiLang = "en" | "es";

/**
 * explain   — a family asks about their own result on /walk (idea #1).
 * walkway   — a family describes the walk in their words; the reply is one English sentence for HISD's form (idea #3).
 * staff     — City or HISD staff ask about the corridor and zone-request data (idea #6).
 * narrative — staff ask for a first draft of one receiving school's school-zone narrative (idea #6).
 * dispatch  — staff ask for the day report (or a question) over the shuttle simulation's route log (/sim).
 */
export type AiMode = "explain" | "walkway" | "staff" | "narrative" | "dispatch";
export const AI_MODES: readonly AiMode[] = ["explain", "walkway", "staff", "narrative", "dispatch"];

export interface AiTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiRequest {
  mode: AiMode;
  lang: AiLang;
  /** explain / walkway: the page's own result for this home (see grounding.ts). Never an address or coordinates. */
  context?: WalkGrounding;
  /** narrative: the receiving school's campus number. */
  nbr?: number;
  /** dispatch: the agent's route log, one "[E12] 7:15 am kind (source): text" line per entry. Simulated; no student data. */
  log?: string;
  messages: AiTurn[];
}

export type AiResponse =
  /** `kind` is set in walkway mode: a draft for the form's box, or a question back to the family. */
  | { ok: true; text: string; kind?: "draft" | "ask"; mock?: boolean }
  | { ok: false; error: "unavailable" | "bad_request" | "failed"; message?: string };

export const LIMITS = {
  /** Turns per conversation, both sides. The page stops offering the box after this. */
  maxTurns: 12,
  /** Characters per message. A family's description of a walk fits in far less. */
  maxMessageChars: 1500,
  /** Serialized context. The largest result in the closed zones is about 1,900 characters. */
  maxContextChars: 8000,
  /** The simulation's route log for a morning of 13 buses runs about 5,000 characters. */
  maxLogChars: 20000,
} as const;

/** One crossing on a walk, as the page states it. Names and distances only; no coordinates. */
export interface GroundCrossing {
  kind: "road" | "rail";
  name: string;
  lists: string[];
  pedCrashesOnSegment?: number;
  pedDeathsOnSegment?: number;
  /** The page's own "where to cross" sentence, in the page's language. */
  whereToCross: string;
  /** Traffic light or public rail crossing within 250 m (820 ft) of where the straight line crosses. */
  controlNearby: boolean;
  /** HPW's written path to a City school zone for this street, when the app knows it. */
  schoolZone?: "borders the school" | "thoroughfare or collector" | "neither (local street)" | "unknown";
  streetOwner?: string | null;
}

export interface GroundWalk {
  to: string;
  miles: number;
  crossings: GroundCrossing[];
}

/** Everything the explainer may say about one home, derived from what the page already shows. */
export interface WalkGrounding {
  closedZone: boolean;
  lastYearSchool?: string;
  lastYearMiles?: number;
  thisYearSchool: string;
  thisYearSchoolAddress: string;
  /** The page's one-line answer. */
  headline: string;
  prek: boolean | null;
  walkToSchool: GroundWalk;
  shuttle?: { pickupAt: string; pickupAddress: string; dropOff: string; runs: string; walkToPickup?: GroundWalk; stopAndTimesPublished: false };
  twoMileRule: "under 2 miles: no bus for distance" | "2 miles or more: ask about the regular bus";
  whoCanChange: string[];
  /** Other sentences the page shows this family (the 2-mile rule after the shuttle, Pre-K), in the page's language. */
  pageSays: string[];
  dataNotes: string[];
}
