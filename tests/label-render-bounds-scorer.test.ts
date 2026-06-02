import test from "node:test";
import assert from "node:assert/strict";
import { labelRenderBoundsScorer } from "../evals/scorers/labelRenderBounds";
import { serializeCanvasState } from "../src/context/canvas-state";

test("labelRenderBoundsScorer passes when text bounds are safe", () => {
  const result = labelRenderBoundsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [{ id: "label", type: "text", text: "Some text", width: 140, height: 40, x: 0, y: 0 }],
    },
  } as never);

  assert.equal(typeof result, "object");
  assert.equal((result as { score: number }).score, 1);
});

test("labelRenderBoundsScorer reports risky labels", () => {
  const result = labelRenderBoundsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        {
          id: "rect_label",
          type: "text",
          text: "Authentication Service",
          width: 50,
          height: 40,
          x: 0,
          y: 0,
          containerId: "rect",
        },
      ],
    },
  } as never) as { score: number; metadata: { passed: boolean; risky: { id: string }[] } };

  assert.equal(result.score, 0);
  assert.equal(result.metadata.passed, false);
  assert.deepEqual(result.metadata.risky.map((risk) => risk.id), ["rect_label"]);
});

test("labelRenderBoundsScorer reports labels whose longest word would wrap", () => {
  const result = labelRenderBoundsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        {
          id: "decision_label",
          type: "text",
          text: "Cooked?",
          width: 60,
          height: 40,
          x: 0,
          y: 0,
          containerId: "decision",
        },
      ],
    },
  } as never) as { score: number; metadata: { passed: boolean; risky: { id: string }[] } };

  assert.equal(result.score, 0);
  assert.equal(result.metadata.passed, false);
  assert.deepEqual(result.metadata.risky.map((risk) => risk.id), ["decision_label"]);
});

test("serializeCanvasState surfaces label render risks to queryCanvas", () => {
  const summary = serializeCanvasState([
    { id: "rect", type: "rectangle", x: 100, y: 100, width: 220, height: 120 },
    {
      id: "rect_label",
      type: "text",
      x: 185,
      y: 140,
      width: 48,
      height: 32,
      text: "Some text",
      fontSize: 20,
      containerId: "rect",
    },
  ]);

  assert.match(summary, /Labels\/text that may be clipped or unreadable/);
  assert.match(summary, /rect_label "Some text"/);
});
