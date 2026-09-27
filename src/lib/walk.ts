// One address, the walks a family makes from it, and the URL that carries it between the Walk Check screens.
// Every screen after the address box reads the same ?lat&lng&addr(&prek)(&slat&slng) parameters, so any screen can be
// shared or reloaded on its own.
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { type AddressResult, type Hazard, type RouteResult, analyzeAddress } from "./analyze";
import { type WalkPlan, planWalk, zonePossible } from "./crossings";
import { type AppData, type ShuttleStat, type ZonePath, shuttleFrom, useData } from "./data";
import type { LngLat } from "./geo";

/** What the one-line answer counts: any active railroad, and how many distinct listed roads. */
export const crossCounts = (hz: Hazard[]) => ({ rail: hz.some((h) => h.kind === "rail"), roads: hz.filter((h) => h.kind === "road").length });

/**
 * The walk to the closure shuttle's pickup, while the shuttle runs (2026–27 and 2027–28). The pickup is the
 * 2025–26 campus, so it's the same straight line as the walk to last year's school.
 */
export const shuttleWalk = (r: AddressResult, s?: ShuttleStat) => (s && !s.sameSite && r.old ? r.old : undefined);

/** Where-to-cross plans for the walks a family makes now: to the shuttle pickup (while it runs), and to the new school. */
export function walkPlans(d: AppData, r: AddressResult, s?: ShuttleStat): WalkPlan[] {
  const sw = shuttleWalk(r, s);
  return [sw, r.now].filter((x): x is RouteResult => !!x).map((route) => planWalk(r.point, route, d.ds));
}

export interface Walk {
  home: LngLat;
  addr: string;
  prek: boolean | null;
  /** The suggested bus stop, dragged on the "Ask HISD for a bus" screen; the home until then. */
  stop: LngLat;
  r: AddressResult;
  shuttle?: ShuttleStat;
  /** The walk to the shuttle pickup, while it runs. */
  sw?: RouteResult;
  /** The shuttle walk's plan (when there is one), then the new school's. */
  plans: WalkPlan[];
  swPlan?: WalkPlan;
  nowPlan?: WalkPlan;
  /** The same parameters, to carry to the next screen. */
  params: URLSearchParams;
}

export const walkQuery = (p: LngLat, addr: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({ lat: p[1].toFixed(6), lng: p[0].toFixed(6), addr, ...extra });

/** The address in the URL, analysed. Null when the link carries no usable location. */
export function useWalk(): Walk | null {
  const d = useData();
  const [params] = useSearchParams();
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  const ok = params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng);
  const slat = Number(params.get("slat")), slng = Number(params.get("slng"));
  const prekRaw = params.get("prek");
  const key = params.toString();
  return useMemo(() => {
    if (!ok) return null;
    const home: LngLat = [lng, lat];
    const r = analyzeAddress(home, d.ds);
    const shuttle = r.oldZone ? shuttleFrom(d, Number(r.oldZone.Campus__Number)) : undefined;
    const sw = shuttleWalk(r, shuttle);
    const plans = walkPlans(d, r, shuttle);
    return {
      home, r, shuttle, sw, plans,
      addr: params.get("addr") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      prek: prekRaw === "1" ? true : prekRaw === "0" ? false : null,
      stop: params.has("slat") && Number.isFinite(slat) && Number.isFinite(slng) ? [slng, slat] : home,
      swPlan: sw ? plans[0] : undefined,
      nowPlan: r.now ? plans[plans.length - 1] : undefined,
      params: new URLSearchParams(params),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, d]);
}

/**
 * The City school-zone facts for each road this walk crosses (to the new school, then to the shuttle): the receiving
 * school's row in zone_requests.json when the closure newly put the street on the walk, else the corridor list's facts.
 * `path` is HPW's written path; `possible` folds in City ownership, and is null when neither list has the street.
 */
export function zoneStreets(d: AppData, w: Walk): { hazard: Hazard; path: ZonePath | null; owner: string | null; possible: boolean | null }[] {
  const now = w.r.now?.school;
  const school = d.zoneRequests.schools.find((s) => s.nbr === now?.nbr);
  const roads = [...(w.r.now?.hazards ?? []), ...(w.sw?.hazards ?? [])].filter((h, i, a) => h.kind === "road" && a.findIndex((x) => x.key === h.key) === i);
  return roads.map((h) => {
    const req = school?.streets.find((s) => s.key === h.key);
    if (req) {
      const owner = req.streetClass?.owner ?? null;
      return { hazard: h, path: req.path, owner, possible: req.path !== "neither" && (!owner || owner === "COH") };
    }
    const row = d.corridors.find((c) => c.key === h.key);
    if (!row?.streetClass) return { hazard: h, path: null, owner: null, possible: null };
    const path: ZonePath = now && row.bordersSchool?.includes(now.name) ? "borders" : row.streetClass.thoroughfareOrCollector ? "thoroughfare-collector" : "neither";
    return { hazard: h, path, owner: row.streetClass.owner, possible: zonePossible(row) };
  });
}
