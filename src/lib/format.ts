import { METERS_PER_MILE } from "./geo";

export const mi = (m: number) => `${(m / METERS_PER_MILE).toFixed(2)} mi`;
export const signedMi = (m: number) => `${m >= 0 ? "+" : "−"}${(Math.abs(m) / METERS_PER_MILE).toFixed(2)} mi`;
export const pct = (x: number) => `${x.toFixed(1)}%`;
export const coord = ([lng, lat]: [number, number]) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/** A walking distance in feet (then miles), in both languages: US readers, US units. */
export function dist(m: number, lang: "en" | "es"): string {
  return m < 402 ? `${Math.max(50, Math.round((m * 3.28084) / 50) * 50)} ${lang === "es" ? "pies" : "ft"}` : `${(m / METERS_PER_MILE).toFixed(1)} mi`;
}
