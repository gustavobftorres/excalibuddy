import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMessageRenderKeys,
  createOneShotMessageIdGenerator,
} from "../src/chat-message-ids";

test("createOneShotMessageIdGenerator consumes the pending id only once", () => {
  let pendingId: string | undefined = "assistant-turn-1";
  let fallbackCount = 0;
  const generateId = createOneShotMessageIdGenerator(
    () => pendingId,
    () => {
      pendingId = undefined;
    },
    () => `fallback-${++fallbackCount}`
  );

  assert.equal(generateId(), "assistant-turn-1");
  assert.equal(generateId(), "fallback-1");
  assert.equal(generateId(), "fallback-2");
});

test("buildMessageRenderKeys makes duplicate message ids render-safe", () => {
  assert.deepEqual(
    buildMessageRenderKeys([
      { id: "assistant-turn-1" },
      { id: "assistant-turn-1" },
      { id: "user-turn-2" },
      { id: "assistant-turn-1" },
    ]),
    [
      "assistant-turn-1",
      "assistant-turn-1#2",
      "user-turn-2",
      "assistant-turn-1#3",
    ]
  );
});
