// The API is a separate service (server/). VITE_API_URL is its base URL, baked in at build time; unset, the page asks its own
// origin, which in `npm run dev` vite proxies to the local server.
export const apiUrl = (path: string) => `${(import.meta.env?.VITE_API_URL ?? "").replace(/\/$/, "")}${path}`;
