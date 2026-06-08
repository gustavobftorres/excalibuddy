import test from "node:test";
import assert from "node:assert/strict";

import { verifyCanvasUsageScorer } from "../evals/scorers/verifyCanvasUsage";

test("verifyCanvasUsageScorer requires verifyCanvas after create mutations for connected requests", () => {
  const missing = verifyCanvasUsageScorer({
    expected: {
      id: "flow",
      input: "Draw a flow from Login to API",
      expectedCharacteristics: [],
      difficulty: "medium",
      category: "create",
    },
    output: { text: "", elements: [], toolCalls: ["addElements"] },
  } as never) as { score: number; metadata: { reason: string } };

  assert.equal(missing.score, 0);
  assert.equal(missing.metadata.reason, "verifyCanvas not called after mutation");

  const present = verifyCanvasUsageScorer({
    expected: {
      id: "flow",
      input: "Draw a flow from Login to API",
      expectedCharacteristics: [],
      difficulty: "medium",
      category: "create",
    },
    output: { text: "", elements: [], toolCalls: ["addElements", "verifyCanvas"] },
  } as never) as { score: number };

  assert.equal(present.score, 1);
});

test("verifyCanvasUsageScorer skips non connected requests", () => {
  const result = verifyCanvasUsageScorer({
    expected: {
      id: "freeform",
      input: "Draw a circle and a square next to each other",
      expectedCharacteristics: [],
      difficulty: "simple",
      category: "create",
    },
    output: { text: "", elements: [], toolCalls: ["addElements"] },
  } as never);

  assert.equal(result, null);
});

test("verifyCanvasUsageScorer skips simple label-only edits", () => {
  const result = verifyCanvasUsageScorer({
    expected: {
      id: "modify-03",
      input: "rename the Process box to Validate",
      expectedCharacteristics: [],
      difficulty: "medium",
      category: "modify",
    },
    output: { text: "", elements: [], toolCalls: ["queryCanvas", "updateElements"] },
  } as never);

  assert.equal(result, null);
});
