import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { getLatestPlanApprovalMessage } from "../src/planning/messages";

test("getLatestPlanApprovalMessage returns the latest plan approval tool call", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-requestPlanApproval",
          toolCallId: "tool-old",
          state: "output-available",
          input: {
            title: "Old plan",
            summary: "Old summary",
            steps: ["Old step"],
            assumptions: [],
            questions: [],
          },
        },
      ],
    },
    {
      id: "assistant-2",
      role: "assistant",
      parts: [
        {
          type: "tool-requestPlanApproval",
          toolCallId: "tool-new",
          state: "output-available",
          input: {
            title: "New plan",
            summary: "New summary",
            steps: ["New step"],
            assumptions: [],
            questions: [],
          },
        },
      ],
    },
  ] satisfies UIMessage[];

  const latest = getLatestPlanApprovalMessage(messages);

  assert.equal(latest?.toolCallId, "tool-new");
  assert.equal(latest?.plan.title, "New plan");
});

test("getLatestPlanApprovalMessage ignores non-plan assistant messages", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Clarifying question" }],
    },
  ] satisfies UIMessage[];

  assert.equal(getLatestPlanApprovalMessage(messages), null);
});
