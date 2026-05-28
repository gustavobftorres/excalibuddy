import { DesignAgent } from "./agent";
import { routeAgentRequest } from "agents";
import { insertProjectLog, logProjectFeedback, shouldLogTraces } from "./observability/braintrust";
import type { UserFeedback } from "./flywheel/types";

export { DesignAgent };

interface Env {
  DesignAgent: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  TAVILY_API_KEY: string;
  UPSTASH_VECTOR_REST_URL: string;
  UPSTASH_VECTOR_REST_TOKEN: string;
  FRONTEND_ORIGIN?: string;
  BRAINTRUST_API_KEY?: string;
  BRAINTRUST_PROJECT_ID?: string;
  TRACE_LOGGING_ENABLED?: string;
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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, request: Request, env: Env, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return withCors(new Response(JSON.stringify(body), { ...init, headers }), request, env);
}

async function handleFinalizeTrace(request: Request, env: Env): Promise<Response> {
  const body = (await readJson(request)) as {
    turnId?: string;
    sessionId?: string;
    assistantMessageId?: string;
    finalText?: string;
    finalCanvasSummary?: unknown;
    toolCalls?: unknown[];
  } | null;

  if (!body?.turnId) {
    return jsonResponse({ error: "turnId is required" }, request, env, { status: 400 });
  }

  if (
    shouldLogTraces({
      apiKey: env.BRAINTRUST_API_KEY,
      projectId: env.BRAINTRUST_PROJECT_ID,
      enabled: env.TRACE_LOGGING_ENABLED,
    })
  ) {
    await insertProjectLog({
      apiKey: env.BRAINTRUST_API_KEY as string,
      projectId: env.BRAINTRUST_PROJECT_ID as string,
      event: {
        id: body.turnId,
        output: {
          finalText: body.finalText ?? "",
          finalCanvasSummary: body.finalCanvasSummary,
          toolCalls: body.toolCalls ?? [],
        },
        tags: ["production", "assistant-turn", "diagram-agent", "client-finalized"],
        metadata: {
          sessionId: body.sessionId,
          assistantMessageId: body.assistantMessageId,
          finalized: true,
        },
      },
    });
  }

  return jsonResponse({ ok: true }, request, env);
}

async function handleFeedback(request: Request, env: Env): Promise<Response> {
  const body = (await readJson(request)) as UserFeedback | null;

  if (!body?.turnId || (body.rating !== 0 && body.rating !== 1) || !body.assistantMessageId || !body.sessionId) {
    return jsonResponse({ error: "turnId, rating, assistantMessageId, and sessionId are required" }, request, env, {
      status: 400,
    });
  }

  if (
    shouldLogTraces({
      apiKey: env.BRAINTRUST_API_KEY,
      projectId: env.BRAINTRUST_PROJECT_ID,
      enabled: env.TRACE_LOGGING_ENABLED,
    })
  ) {
    await logProjectFeedback({
      apiKey: env.BRAINTRUST_API_KEY as string,
      projectId: env.BRAINTRUST_PROJECT_ID as string,
      feedback: {
        id: body.turnId,
        scores: { user_feedback: body.rating },
        comment: body.comment,
        metadata: {
          sessionId: body.sessionId,
          assistantMessageId: body.assistantMessageId,
        },
        source: "app",
      },
    });
  }

  return jsonResponse({ ok: true }, request, env);
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/traces/finalize") {
      return handleFinalizeTrace(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/feedback") {
      return handleFeedback(request, env);
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
