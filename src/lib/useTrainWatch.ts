// One Train Watch poll shared by every component on the page. It starts with the first subscriber, stops with the
// last, and pauses while the tab is hidden (a family's prepaid data plan pays for every request).
import { useMemo, useSyncExternalStore } from "react";
import { POLL_MS, type TwStatus, fetchTrainWatch } from "./live";

export interface LiveState {
  /** When the last good read came back (epoch ms); null before the first. */
  at: number | null;
  byId: Map<string, TwStatus>;
  /** The last read failed; `byId` still holds the previous good read, if any. */
  error: boolean;
}

let state: LiveState = { at: null, byId: new Map(), error: false };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let ctrl: AbortController | null = null;
let inflight = false;

const emit = () => listeners.forEach((l) => l());

async function tick() {
  timer = null;
  if (typeof document !== "undefined" && document.hidden) return; // resumed by visibilitychange
  ctrl = new AbortController();
  inflight = true;
  try {
    const { at, statuses } = await fetchTrainWatch(ctrl.signal);
    state = { at, byId: new Map(statuses.map((s) => [s.id, s])), error: false };
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    state = { ...state, error: true };
  } finally {
    inflight = false;
  }
  emit();
  if (listeners.size) timer = setTimeout(tick, POLL_MS);
}

function onVisible() {
  if (!document.hidden && listeners.size && !timer && !inflight) tick();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisible);
    tick();
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      timer = null;
      ctrl?.abort();
    }
  };
}

const noop = () => () => {};
const idle: LiveState = { at: null, byId: new Map(), error: false };

/** The live Train Watch state. Pass `false` to not poll at all (printed pages, pages with no rail crossing). */
export function useTrainWatch(enabled = true): LiveState {
  const s = useSyncExternalStore(enabled ? subscribe : noop, () => (enabled ? state : idle), () => idle);
  return useMemo(() => s, [s]);
}
