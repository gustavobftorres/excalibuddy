import test from "node:test";
import assert from "node:assert/strict";
import {
  insertProjectLog,
  logProjectFeedback,
  shouldLogTraces,
} from "../src/observability/braintrust";
import { createWorkerFetchHandler } from "../src/worker-fetch";

test("insertProjectLog sends a Braintrust project log event", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ row_ids: ["trace-1"] }), { status: 200 });
  };

  await insertProjectLog({
    apiKey: "bt-key",
    projectId: "project-1",
    fetcher,
    event: {
      id: "trace-1",
      input: { prompt: "Draw a box" },
      output: { text: "Done" },
      tags: ["assistant-turn"],
      metadata: { model: "gpt-test" },
      metrics: { start: 10, end: 20 },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.braintrust.dev/v1/project_logs/project-1/insert");
  assert.equal(calls[0]?.init.method, "POST");
  assert.deepEqual(calls[0]?.init.headers, {
    Authorization: "Bearer bt-key",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    events: [
      {
        id: "trace-1",
        input: { prompt: "Draw a box" },
        output: { text: "Done" },
        tags: ["assistant-turn"],
        metadata: { model: "gpt-test" },
        metrics: { start: 10, end: 20 },
      },
    ],
  });
});

test("logProjectFeedback sends score, comment, metadata, and source", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ status: "success" }), { status: 200 });
  };

  await logProjectFeedback({
    apiKey: "bt-key",
    projectId: "project-1",
    fetcher,
    feedback: {
      id: "trace-1",
      scores: { user_feedback: 0 },
      comment: "Wrong layout",
      metadata: { sessionId: "session-1" },
      source: "app",
    },
  });

  assert.equal(calls[0]?.url, "https://api.braintrust.dev/v1/project_logs/project-1/feedback");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    feedback: [
      {
        id: "trace-1",
        scores: { user_feedback: 0 },
        comment: "Wrong layout",
        metadata: { sessionId: "session-1" },
        source: "app",
      },
    ],
  });
});

test("Braintrust helpers fail closed when logging is disabled or remote logging fails", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response("nope", { status: 500 });
  };

  assert.equal(shouldLogTraces({ apiKey: "key", projectId: "project", enabled: "false" }), false);
  assert.equal(shouldLogTraces({ apiKey: "key", projectId: "project", enabled: undefined }), true);
  assert.equal(shouldLogTraces({ apiKey: "", projectId: "project", enabled: "true" }), false);

  await insertProjectLog({
    apiKey: "bt-key",
    projectId: "project-1",
    fetcher,
    event: { id: "trace-1" },
  });

  assert.equal(calls, 1);
});

test("finalize trace endpoint logs final canvas summary on the same turn id", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ row_ids: ["turn-1"] }), { status: 200 });
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    const handler = createWorkerFetchHandler({
      routeAgentRequest: async () => undefined,
    });

    const response = await handler(
      new Request("https://example.com/api/traces/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        },
        body: JSON.stringify({
          turnId: "turn-1",
          sessionId: "session-1",
          assistantMessageId: "assistant-turn-1",
          finalText: "Done.",
          finalCanvasSummary: [{ id: "rect_user", type: "rectangle", label: "User" }],
          toolCalls: [{ name: "addElements", output: { added: 1 } }],
        }),
      }),
      {
        BRAINTRUST_API_KEY: "bt-key",
        BRAINTRUST_PROJECT_ID: "project-1",
        TRACE_LOGGING_ENABLED: "true",
        FRONTEND_ORIGIN: "https://example.com",
      } as never
    );

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);

    const payload = JSON.parse(String(calls[0]?.init.body));
    assert.deepEqual(payload.events[0], {
      id: "turn-1",
      output: {
        finalText: "Done.",
        finalCanvasSummary: [{ id: "rect_user", type: "rectangle", label: "User" }],
        toolCalls: [{ name: "addElements", output: { added: 1 } }],
      },
      tags: ["production", "assistant-turn", "diagram-agent", "client-finalized"],
      metadata: {
        sessionId: "session-1",
        assistantMessageId: "assistant-turn-1",
        finalized: true,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
