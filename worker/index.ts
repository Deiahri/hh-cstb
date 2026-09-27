// The Cloudflare Worker that serves Walk Check: the built site from ./dist (static assets, served before this code
// runs), and the AI proxy at /api/ai. Anything else that isn't a file falls through to the assets, which answer 404.
import { type Env, onRequestGet, onRequestPost } from "./ai";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/ai") {
      if (request.method === "GET") return onRequestGet({ request, env });
      if (request.method === "POST") return onRequestPost({ request, env });
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
    }
    return env.ASSETS.fetch(request);
  },
};
