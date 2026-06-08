import test from "node:test";
import assert from "node:assert/strict";
import { boundLabelsScorer } from "../evals/scorers/boundLabels";
import { connectivityScorer } from "../evals/scorers/connectivity";
import { noOverlapsScorer } from "../evals/scorers/noOverlaps";

test("boundLabelsScorer reports shapes without bound text labels", () => {
  const result = boundLabelsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "rect_labeled", type: "rectangle", x: 0, y: 0, width: 120, height: 80 },
        { id: "rect_unlabeled", type: "rectangle", x: 200, y: 0, width: 120, height: 80 },
        {
          id: "label_labeled",
          type: "text",
          text: "Labeled",
          x: 20,
          y: 20,
          width: 80,
          height: 30,
          containerId: "rect_labeled",
        },
      ],
    },
  } as never) as { score: number; metadata: { unlabeled: string[] } };

  assert.equal(result.score, 0.5);
  assert.deepEqual(result.metadata.unlabeled, ["rect_unlabeled"]);
});

test("connectivityScorer scores reachable shapes for connected prompts", () => {
  const result = connectivityScorer({
    input: {
      id: "flow",
      input: "Draw a flow from Login to API to Database",
      expectedCharacteristics: [],
      difficulty: "medium",
      category: "create",
    },
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "rect_login", type: "rectangle", x: 0, y: 0, width: 120, height: 80 },
        { id: "rect_api", type: "rectangle", x: 200, y: 0, width: 120, height: 80 },
        { id: "rect_db", type: "rectangle", x: 400, y: 0, width: 120, height: 80 },
        {
          id: "arrow_login_api",
          type: "arrow",
          x: 120,
          y: 40,
          width: 80,
          height: 0,
          startBinding: { elementId: "rect_login" },
          endBinding: { elementId: "rect_api" },
        },
      ],
    },
  } as never) as { score: number; metadata: { reachable: number; total: number } };

  assert.ok(Math.abs(result.score - 2 / 3) < Number.EPSILON);
  assert.deepEqual(result.metadata, { reachable: 2, total: 3 });
});

test("noOverlapsScorer reports colliding eligible elements", () => {
  const result = noOverlapsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "rect_a", type: "rectangle", x: 0, y: 0, width: 120, height: 80 },
        { id: "rect_b", type: "rectangle", x: 60, y: 0, width: 120, height: 80 },
        { id: "rect_c", type: "rectangle", x: 300, y: 0, width: 120, height: 80 },
      ],
    },
  } as never) as {
    score: number;
    metadata: { passed: boolean; overlapping_pairs: [string, string][]; total_pairs: number };
  };

  assert.ok(Math.abs(result.score - (1 - 1 / 3)) < Number.EPSILON);
  assert.equal(result.metadata.passed, false);
  assert.deepEqual(result.metadata.overlapping_pairs, [["rect_a", "rect_b"]]);
  assert.equal(result.metadata.total_pairs, 3);
});
