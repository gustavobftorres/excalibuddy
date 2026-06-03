import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { getRetryMessage } from "../src/components/chat/retry";

test("getRetryMessage returns the latest user text message", () => {
  const messages = [
    {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "Draw a login flow" }],
    },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Done" }],
    },
    {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "Make the login box red" }],
    },
  ] satisfies UIMessage[];

  assert.deepEqual(getRetryMessage(messages), {
    role: "user",
    parts: [{ type: "text", text: "Make the login box red" }],
  });
});

test("getRetryMessage skips user messages without reusable text", () => {
  const messages = [
    {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "Draw a login flow" }],
    },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Done" }],
    },
    {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "   " }],
    },
  ] satisfies UIMessage[];

  assert.deepEqual(getRetryMessage(messages), {
    role: "user",
    parts: [{ type: "text", text: "Draw a login flow" }],
  });
});

test("getRetryMessage returns null when there is no user text to retry", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Done" }],
    },
  ] satisfies UIMessage[];

  assert.equal(getRetryMessage(messages), null);
});
