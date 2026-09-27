import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built dist/ works from any static host or subfolder.
export default defineConfig({ base: "./", plugins: [react()], server: { proxy: { "/api": "http://127.0.0.1:3000" } } });
