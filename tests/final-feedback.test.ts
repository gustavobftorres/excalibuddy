import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import {
  getFinalFeedbackCandidate,
  isFinalFeedbackCandidate,
} from "../src/flywheel/final-feedback";

function assistantMessage(
  id: string,
  parts: UIMessage["parts"],
  metadata: Record<string, unknown> = { turnId: "turn-1", sessionId: "session-1" }
): UIMessage {
  return {
    id,
    role: "assistant",
    metadata,
    parts,
  } as UIMessage;
}

function userMessage(id: string): UIMessage {
  return {
    id,
    role: "user",
    metadata: { turnId: "turn-1", sessionId: "session-1" },
    parts: [{ type: "text", text: "Draw a flowchart" }],
  } as UIMessage;
}

test("isFinalFeedbackCandidate rejects assistant messages with pending tool calls", () => {
  const message = assistantMessage("assistant-1", [
    { type: "text", text: "Working..." },
    {
      type: "tool-addElements",
      toolCallId: "call-1",
      state: "input-available",
      input: { elements: [] },
    } as never,
  ]);

  assert.equal(isFinalFeedbackCandidate(message), false);
});

test("isFinalFeedbackCandidate rejects user messages", () => {
  assert.equal(isFinalFeedbackCandidate(userMessage("user-1")), false);
});

test("isFinalFeedbackCandidate accepts assistant messages with completed tool calls and turn metadata", () => {
  const message = assistantMessage("assistant-1", [
    {
      type: "tool-addElements",
      toolCallId: "call-1",
      state: "output-available",
      input: { elements: [] },
      output: { added: 0 },
    } as never,
    { type: "text", text: "Done." },
  ]);

  assert.equal(isFinalFeedbackCandidate(message), true);
});

test("isFinalFeedbackCandidate rejects assistant messages without a turn id", () => {
  const message = assistantMessage(
    "assistant-1",
    [{ type: "text", text: "Done." }],
    { sessionId: "session-1" }
  );

  assert.equal(isFinalFeedbackCandidate(message), false);
});

test("getFinalFeedbackCandidate returns only the latest finalized assistant message", () => {
  const older = assistantMessage("assistant-old", [{ type: "text", text: "Earlier result" }], {
    turnId: "turn-old",
    sessionId: "session-1",
  });
  const latest = assistantMessage("assistant-latest", [{ type: "text", text: "Final result" }], {
    turnId: "turn-latest",
    sessionId: "session-1",
  });

  const candidate = getFinalFeedbackCandidate([
    userMessage("user-1"),
    older,
    userMessage("user-2"),
    latest,
  ]);

  assert.equal(candidate?.message.id, "assistant-latest");
  assert.equal(candidate?.metadata.turnId, "turn-latest");
});

test("getFinalFeedbackCandidate returns undefined while the latest assistant has pending tools", () => {
  const older = assistantMessage("assistant-old", [{ type: "text", text: "Earlier result" }], {
    turnId: "turn-old",
    sessionId: "session-1",
  });
  const latestPending = assistantMessage(
    "assistant-latest",
    [
      {
        type: "tool-verifyCanvas",
        toolCallId: "call-1",
        state: "input-available",
        input: { userRequest: "Draw a flowchart" },
      } as never,
    ],
    {
      turnId: "turn-latest",
      sessionId: "session-1",
    }
  );

  const candidate = getFinalFeedbackCandidate([
    userMessage("user-1"),
    older,
    userMessage("user-2"),
    latestPending,
  ]);

  assert.equal(candidate, undefined);
});
