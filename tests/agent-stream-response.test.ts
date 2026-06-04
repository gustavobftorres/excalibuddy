import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { buildUIMessageStreamResponseOptions } from "../src/agent-stream-options";

test("buildUIMessageStreamResponseOptions reuses original messages for stable streaming ids", () => {
  const messages = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "hi" }] }] satisfies UIMessage[];

  const options = buildUIMessageStreamResponseOptions(messages, "turn-1", "session-1");

  assert.equal(options.originalMessages, messages);
});

test("buildUIMessageStreamResponseOptions can pin the assistant response id", () => {
  const options = buildUIMessageStreamResponseOptions([], "turn-1", "session-1", "assistant-turn-1");

  assert.equal(options.generateMessageId?.(), "assistant-turn-1");
});

test("buildUIMessageStreamResponseOptions attaches turn metadata only to start and finish parts", () => {
  const options = buildUIMessageStreamResponseOptions([], "turn-1", "session-1");

  assert.deepEqual(options.messageMetadata({ part: { type: "start" } }), {
    turnId: "turn-1",
    sessionId: "session-1",
  });
  assert.deepEqual(options.messageMetadata({ part: { type: "finish" } }), {
    turnId: "turn-1",
    sessionId: "session-1",
  });
  assert.equal(options.messageMetadata({ part: { type: "text-delta" } }), undefined);
});
