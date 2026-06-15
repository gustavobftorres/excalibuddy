import test from "node:test";
import assert from "node:assert/strict";
import { boundArrowsScorer } from "../evals/scorers/boundArrows";
import { arrowAnchorGeometryScorer } from "../evals/scorers/arrowAnchorGeometry";
import { arrowPathObstaclesScorer } from "../evals/scorers/arrowPathObstacles";
import { serializeCanvasState } from "../src/context/canvas-state";

test("boundArrowsScorer fails arrows without both shape bindings", () => {
  const result = boundArrowsScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "rect_a", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
        { id: "arrow_a", type: "arrow", x: 100, y: 40, width: 100, height: 0 },
      ],
    },
  } as never) as { score: number; metadata: { broken: string[] } };

  assert.equal(result.score, 0);
  assert.deepEqual(result.metadata.broken, ["arrow_a"]);
});

test("arrowAnchorGeometryScorer fails angled arrows between aligned shapes", () => {
  const result = arrowAnchorGeometryScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "a", type: "rectangle", x: 40, y: 100, width: 240, height: 100 },
        { id: "b", type: "rectangle", x: 40, y: 280, width: 240, height: 100 },
        {
          id: "arrow_a_b",
          type: "arrow",
          x: 165,
          y: 200,
          width: 24,
          height: 80,
          startBinding: { elementId: "a" },
          endBinding: { elementId: "b" },
        },
      ],
    },
  } as never) as { score: number; metadata: { risky: { id: string }[] } };

  assert.equal(result.score, 0);
  assert.deepEqual(result.metadata.risky.map((risk) => risk.id), ["arrow_a_b"]);
});

test("arrowAnchorGeometryScorer fails stable-looking arrows with off-center bindings", () => {
  const result = arrowAnchorGeometryScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "a", type: "rectangle", x: 40, y: 100, width: 240, height: 100 },
        { id: "b", type: "rectangle", x: 40, y: 280, width: 240, height: 100 },
        {
          id: "arrow_a_b",
          type: "arrow",
          x: 160,
          y: 200,
          width: 0,
          height: 80,
          points: [
            [0, 0],
            [0, 80],
          ],
          startBinding: { elementId: "a", focus: 0.45, gap: 1 },
          endBinding: { elementId: "b", focus: -0.45, gap: 1 },
        },
      ],
    },
  } as never) as { score: number; metadata: { risky: { id: string; reason: string }[] } };

  assert.equal(result.score, 0);
  assert.deepEqual(
    result.metadata.risky.map((risk) => ({ id: risk.id, reason: risk.reason })),
    [{ id: "arrow_a_b", reason: "binding_mismatch" }]
  );
});

test("arrowAnchorGeometryScorer fails arrows whose bindings would recalculate to shape centers", () => {
  const result = arrowAnchorGeometryScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "a", type: "rectangle", x: 40, y: 100, width: 240, height: 100 },
        { id: "b", type: "rectangle", x: 40, y: 280, width: 240, height: 100 },
        {
          id: "arrow_a_b",
          type: "arrow",
          x: 160,
          y: 200,
          width: 0,
          height: 80,
          points: [
            [0, 0],
            [0, 80],
          ],
          startBinding: { elementId: "a", focus: 0, gap: 0 },
          endBinding: { elementId: "b", focus: 0, gap: 0 },
        },
      ],
    },
  } as never) as { score: number; metadata: { risky: { id: string; reason: string }[] } };

  assert.equal(result.score, 0);
  assert.deepEqual(
    result.metadata.risky.map((risk) => ({ id: risk.id, reason: risk.reason })),
    [{ id: "arrow_a_b", reason: "binding_mismatch" }]
  );
});

test("arrowPathObstaclesScorer fails arrows crossing unrelated shapes", () => {
  const result = arrowPathObstaclesScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 100, width: 100, height: 80 },
        { id: "b", type: "rectangle", x: 180, y: 90, width: 100, height: 100 },
        { id: "c", type: "rectangle", x: 360, y: 100, width: 100, height: 80 },
        {
          id: "arrow_a_c",
          type: "arrow",
          x: 100,
          y: 140,
          width: 260,
          height: 0,
          points: [
            [0, 0],
            [260, 0],
          ],
          startBinding: { elementId: "a", focus: 0, gap: 1 },
          endBinding: { elementId: "c", focus: 0, gap: 1 },
        },
      ],
    },
  } as never) as { score: number; metadata: { risky: { arrowId: string; blockedBy: string[] }[] } };

  assert.equal(result.score, 0);
  assert.deepEqual(result.metadata.risky, [
    { arrowId: "arrow_a_c", startId: "a", endId: "c", blockedBy: ["b"] },
  ]);
});

test("arrowPathObstaclesScorer accepts routed arrows around unrelated shapes", () => {
  const result = arrowPathObstaclesScorer({
    output: {
      text: "",
      toolCalls: [],
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 100, width: 100, height: 80 },
        { id: "b", type: "rectangle", x: 180, y: 90, width: 100, height: 100 },
        { id: "c", type: "rectangle", x: 360, y: 100, width: 100, height: 80 },
        {
          id: "arrow_a_c",
          type: "arrow",
          x: 100,
          y: 140,
          width: 260,
          height: 0,
          points: [
            [0, 0],
            [130, -86],
            [260, 0],
          ],
          startBinding: { elementId: "a", focus: 0, gap: 1 },
          endBinding: { elementId: "c", focus: 0, gap: 1 },
        },
      ],
    },
  } as never) as { score: number; metadata: { passed: boolean; risky: unknown[] } };

  assert.equal(result.score, 1);
  assert.equal(result.metadata.passed, true);
  assert.deepEqual(result.metadata.risky, []);
});

test("serializeCanvasState surfaces unbound, angled, and obstructed arrows to queryCanvas", () => {
  const summary = serializeCanvasState([
    { id: "a", type: "rectangle", x: 40, y: 100, width: 240, height: 100 },
    { id: "b", type: "rectangle", x: 40, y: 280, width: 240, height: 100 },
    { id: "blocker", type: "rectangle", x: 360, y: 110, width: 80, height: 80 },
    { id: "c", type: "rectangle", x: 520, y: 100, width: 120, height: 100 },
    {
      id: "arrow_a_b",
      type: "arrow",
      x: 165,
      y: 200,
      width: 24,
      height: 80,
      startBinding: { elementId: "a" },
      endBinding: { elementId: "b" },
    },
    {
      id: "arrow_a_c",
      type: "arrow",
      x: 280,
      y: 150,
      width: 240,
      height: 0,
      points: [
        [0, 0],
        [240, 0],
      ],
      startBinding: { elementId: "a", focus: 0, gap: 1 },
      endBinding: { elementId: "c", focus: 0, gap: 1 },
    },
    { id: "arrow_floating", type: "arrow", x: 0, y: 0, width: 10, height: 10 },
  ]);

  assert.match(summary, /Unbound arrows/);
  assert.match(summary, /Angled arrows between aligned shapes/);
  assert.match(summary, /Arrows crossing unrelated shapes/);
  assert.match(summary, /arrow_a_c: crosses blocker/);
});
