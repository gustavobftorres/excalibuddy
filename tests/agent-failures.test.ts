import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { classifyAgentFailure, getLatestToolFailure } from "../src/agent-failures";

test("classifyAgentFailure separates timeout, network, and generic agent failures", () => {
  assert.equal(classifyAgentFailure(new Error("Request timed out after 60s")), "timeout");
  assert.equal(classifyAgentFailure(new Error("Failed to fetch")), "network");
  assert.equal(classifyAgentFailure(new Error("Model returned invalid tool input")), "agent");
  assert.equal(classifyAgentFailure(new Error("Anything"), false), "network");
});

test("getLatestToolFailure finds the newest failed tool call", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      metadata: { turnId: "turn-1", sessionId: "session-1" },
      parts: [
        {
          type: "tool-addElements",
          state: "output-error",
          errorText: "invalid element schema",
        },
      ],
    },
  ] as UIMessage[];

  const failure = getLatestToolFailure(messages);

  assert.deepEqual(failure, {
    turnId: "turn-1",
    sessionId: "session-1",
    assistantMessageId: "assistant-1",
    kind: "agent",
    source: "tool",
    message: "invalid element schema",
    toolName: "addElements",
  });
});
