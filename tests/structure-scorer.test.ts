import test from "node:test";
import assert from "node:assert/strict";

import { structureScorer } from "../evals/scorers/structure";

test("structureScorer skips cases without countable expectations", () => {
  const result = structureScorer({
    expected: {
      id: "qualitative",
      input: "Draw a deployment diagram",
      expectedCharacteristics: [
        "Deployment box containing or managing Pods",
        "Service box pointing to the Pods via label selector",
      ],
      difficulty: "hard",
      category: "domain",
    },
    output: {
      text: "",
      toolCalls: [],
      elements: [{ id: "rect_deployment", type: "rectangle", x: 0, y: 0, width: 240, height: 100 }],
    },
  } as never);

  assert.equal(result, null);
});

test("structureScorer still scores parseable element count expectations", () => {
  const result = structureScorer({
    expected: {
      id: "countable",
      input: "Draw a flow",
      expectedCharacteristics: ["3 rectangle elements", "2 arrow elements"],
      difficulty: "simple",
      category: "create",
    },
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "rect_a", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
        { id: "rect_b", type: "rectangle", x: 140, y: 0, width: 100, height: 80 },
        { id: "arrow_a_b", type: "arrow", x: 100, y: 40, width: 40, height: 0 },
      ],
    },
  } as never) as { score: number; metadata: { expectedCounts: Record<string, number> } };

  assert.ok(Math.abs(result.score - (2 / 3 + 1 / 2) / 2) < Number.EPSILON);
  assert.deepEqual(result.metadata.expectedCounts, { rectangle: 3, arrow: 2 });
});
