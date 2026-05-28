import { DesignAgent } from "./agent";
import { routeAgentRequest } from "agents";

export { DesignAgent };

interface Env {
  DesignAgent: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  TAVILY_API_KEY: string;
  UPSTASH_VECTOR_REST_URL: string;
  UPSTASH_VECTOR_REST_TOKEN: string;
  FRONTEND_ORIGIN?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://excalidraw-buddy.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigins = new Set(
    [...DEFAULT_ALLOWED_ORIGINS, env.FRONTEND_ORIGIN].filter(Boolean)
  );

  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    const response =
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 });

    if (request.headers.get("Upgrade") === "websocket") {
      return response;
    }

    return withCors(response, request, env);
  },
} satisfies ExportedHandler<Env>;
