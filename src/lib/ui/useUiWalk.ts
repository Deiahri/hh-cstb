// The home in the URL, as every walk screen reads it: /walk, /help, /bus, /schoolzone and /packet all carry the same
// ?lat&lng&addr&prek(&geo) parameters, so any of them can be reloaded or shared on its own.
import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useData } from "../data";
import type { LngLat } from "../geo";
import { type Walk, useWalk } from "../walk";
import { type UiResult, toUiResult } from "./model";

// Opened from someone else's link: this browser tab hadn't been here before, and it landed straight on a walk.
const SHARED_AT_LOAD = (() => {
  try {
    const first = !sessionStorage.getItem("wc.seen");
    sessionStorage.setItem("wc.seen", "1");
    return first && /[?&]lat=/.test(window.location.hash);
  } catch {
    return false;
  }
})();

export interface UiWalk {
  w: Walk;
  r: UiResult | null;
  addr: string;
  prek: boolean;
  /** The address came from the geocoder (not a sample point or a map tap). */
  geocoded: boolean;
  /** Opened from someone else's link. */
  shared: boolean;
  /** `/screen?same parameters`, with overrides. */
  to: (screen: string, extra?: Record<string, string>) => string;
}

export function useUiWalk(): UiWalk | null {
  const d = useData();
  const w = useWalk();
  const [params] = useSearchParams();
  // Only the page the tab opened on: the router gives the first location the key "default".
  const loc = useLocation();
  const shared = SHARED_AT_LOAD && loc.key === "default";
  const key = params.toString();
  return useMemo(() => {
    if (!w) return null;
    return {
      w,
      r: toUiResult(d, w),
      addr: w.addr,
      prek: params.get("prek") === "1",
      geocoded: params.get("geo") === "1",
      shared,
      to: (screen: string, extra: Record<string, string> = {}) => {
        const p = new URLSearchParams(params);
        for (const [k, v] of Object.entries(extra)) p.set(k, v);
        return `/${screen}?${p}`;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w, d, shared]);
}

/** The walk link for a home: `/walk?lat&lng&addr&prek(&geo)`. */
export function walkLink(p: LngLat, addr: string, o: { prek?: boolean; geocoded?: boolean } = {}) {
  const q = new URLSearchParams({ lat: p[1].toFixed(6), lng: p[0].toFixed(6), addr, prek: o.prek ? "1" : "0" });
  if (o.geocoded) q.set("geo", "1");
  return `/walk?${q}`;
}
