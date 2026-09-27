import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built dist/ works from any static host or subfolder. /api goes to `wrangler pages dev`
// (npm run dev:full, port 8788) when it's running, for the AI panels.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:8788", changeOrigin: true, headers: { origin: "http://localhost:8788" } } } },
});
