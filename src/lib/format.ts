import { METERS_PER_MILE } from "./geo";

export const mi = (m: number) => `${(m / METERS_PER_MILE).toFixed(2)} mi`;
export const signedMi = (m: number) => `${m >= 0 ? "+" : "−"}${(Math.abs(m) / METERS_PER_MILE).toFixed(2)} mi`;
export const pct = (x: number) => `${x.toFixed(1)}%`;
export const coord = ([lng, lat]: [number, number]) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
