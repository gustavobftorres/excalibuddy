import test from "node:test";
import assert from "node:assert/strict";

import { getCorsHeaders } from "../src/cors";
import { createWorkerFetchHandler } from "../src/worker-fetch";

test("getCorsHeaders allows the production excalibuddy domain", () => {
  const headers = getCorsHeaders(
    new Request("https://api.excalibuddy.xyz/api/feedback", {
      headers: { Origin: "https://excalibuddy.xyz" },
    }),
    {} as never
  ) as Record<string, string>;

  assert.equal(headers["Access-Control-Allow-Origin"], "https://excalibuddy.xyz");
  assert.equal(headers.Vary, "Origin");
});

test("worker agent routes include CORS headers when routing fails", async () => {
  const originalError = console.error;
  console.error = () => {};
  const fetch = createWorkerFetchHandler({
    routeAgentRequest: async () => {
      throw new Error("agent route failed");
    },
  });

  try {
    const response = await fetch(
      new Request(
        "https://ai-design-tool.gutobevtorres.workers.dev/agents/design-agent/session/get-messages",
        { headers: { Origin: "https://excalibuddy.xyz" } }
      ),
      {} as never
    );

    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://excalibuddy.xyz");
    assert.equal(response.headers.get("Vary"), "Origin");
    assert.equal(response.status, 500);
  } finally {
    console.error = originalError;
  }
});
