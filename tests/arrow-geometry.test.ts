import test from "node:test";
import assert from "node:assert/strict";
import {
  findArrowAnchorRisks,
  findUnboundArrows,
  normalizeArrowGeometry,
} from "../src/context/arrow-geometry";

const verticalFlow = [
  {
    id: "start",
    type: "ellipse",
    x: 100,
    y: 100,
    width: 120,
    height: 120,
  },
  {
    id: "step",
    type: "rectangle",
    x: 40,
    y: 280,
    width: 240,
    height: 100,
  },
];

test("findUnboundArrows reports arrows without both bindings to shapes", () => {
  const risks = findUnboundArrows([
    ...verticalFlow,
    {
      id: "arrow_floating",
      type: "arrow",
      x: 160,
      y: 220,
      width: 0,
      height: 60,
      startBinding: { elementId: "start" },
      endBinding: null,
    },
  ]);

  assert.deepEqual(risks.map((risk) => risk.id), ["arrow_floating"]);
});

test("findArrowAnchorRisks reports angled arrows between vertically aligned shapes", () => {
  const risks = findArrowAnchorRisks([
    ...verticalFlow,
    {
      id: "arrow_start_step",
      type: "arrow",
      x: 172,
      y: 220,
      width: 22,
      height: 60,
      startBinding: { elementId: "start" },
      endBinding: { elementId: "step" },
    },
  ]);

  assert.deepEqual(risks.map((risk) => risk.id), ["arrow_start_step"]);
});

test("findArrowAnchorRisks accepts straight center-to-center vertical anchors", () => {
  const risks = findArrowAnchorRisks([
    ...verticalFlow,
    {
      id: "arrow_start_step",
      type: "arrow",
      x: 160,
      y: 220,
      width: 0,
      height: 60,
      startBinding: { elementId: "start", focus: 0, gap: 1 },
      endBinding: { elementId: "step", focus: 0, gap: 1 },
    },
  ]);

  assert.deepEqual(risks, []);
});

test("findArrowAnchorRisks reports straight arrows with unstable binding focus", () => {
  const risks = findArrowAnchorRisks([
    ...verticalFlow,
    {
      id: "arrow_start_step",
      type: "arrow",
      x: 160,
      y: 220,
      width: 0,
      height: 60,
      points: [
        [0, 0],
        [0, 60],
      ],
      startBinding: { elementId: "start", focus: 0.45, gap: 1 },
      endBinding: { elementId: "step", focus: -0.4, gap: 1 },
    },
  ]);

  assert.deepEqual(
    risks.map((risk) => [risk.id, risk.reason]),
    [["arrow_start_step", "binding_mismatch"]]
  );
});

test("normalizeArrowGeometry straightens vertical arrows between aligned shapes", () => {
  const normalized = normalizeArrowGeometry([
    ...verticalFlow,
    {
      id: "arrow_start_step",
      type: "arrow",
      x: 172,
      y: 220,
      width: 22,
      height: 60,
      startBinding: { elementId: "start" },
      endBinding: { elementId: "step" },
    },
  ]) as Record<string, unknown>[];

  const arrow = normalized.find((element) => element.id === "arrow_start_step")!;
  assert.equal(arrow.x, 160);
  assert.equal(arrow.y, 220);
  assert.equal(arrow.width, 0);
  assert.equal(arrow.height, 60);
  assert.deepEqual(arrow.points, [
    [0, 0],
    [0, 60],
  ]);
});

test("normalizeArrowGeometry resets bindings to stable edge-center anchors", () => {
  const normalized = normalizeArrowGeometry([
    ...verticalFlow,
    {
      id: "arrow_start_step",
      type: "arrow",
      x: 160,
      y: 220,
      width: 0,
      height: 60,
      points: [
        [0, 0],
        [0, 60],
      ],
      startBinding: { elementId: "start", focus: 0.45, gap: 0 },
      endBinding: { elementId: "step", focus: -0.4, gap: 0 },
    },
  ]) as Record<string, unknown>[];

  const arrow = normalized.find((element) => element.id === "arrow_start_step")!;
  assert.deepEqual(arrow.startBinding, { elementId: "start", focus: 0, gap: 1 });
  assert.deepEqual(arrow.endBinding, { elementId: "step", focus: 0, gap: 1 });
});

test("normalizeArrowGeometry uses diamond corners for vertical aligned arrows", () => {
  const normalized = normalizeArrowGeometry([
    { id: "decision", type: "diamond", x: 100, y: 100, width: 120, height: 120 },
    { id: "next", type: "rectangle", x: 40, y: 280, width: 240, height: 100 },
    {
      id: "arrow_decision_next",
      type: "arrow",
      x: 170,
      y: 220,
      width: 10,
      height: 60,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "next" },
    },
  ]) as Record<string, unknown>[];

  const arrow = normalized.find((element) => element.id === "arrow_decision_next")!;
  assert.equal(arrow.x, 160);
  assert.equal(arrow.y, 220);
  assert.equal(arrow.width, 0);
  assert.equal(arrow.height, 60);
});
