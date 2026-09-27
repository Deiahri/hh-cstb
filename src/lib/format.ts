import { METERS_PER_MILE } from "./geo";

export const mi = (m: number) => `${(m / METERS_PER_MILE).toFixed(2)} mi`;
export const signedMi = (m: number) => `${m >= 0 ? "+" : "−"}${(Math.abs(m) / METERS_PER_MILE).toFixed(2)} mi`;
export const pct = (x: number) => `${x.toFixed(1)}%`;
export const coord = ([lng, lat]: [number, number]) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/** A walking distance in the reader's units: feet (then miles) in English, metres (then km) in Spanish. */
export function dist(m: number, lang: "en" | "es"): string {
  if (lang === "es") return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
  return m < 402 ? `${Math.max(50, Math.round((m * 3.28084) / 50) * 50)} ft` : `${(m / METERS_PER_MILE).toFixed(1)} mi`;
}
