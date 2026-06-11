import test from "node:test";
import assert from "node:assert/strict";
import {
  findArrowLabelClearanceRisks,
  findArrowAnchorRisks,
  findUnboundArrows,
  normalizeArrowLabelClearance,
  normalizeArrowLabelPlacement,
  normalizeArrowGeometry,
} from "../src/context/arrow-geometry";
import { findOverlaps } from "../src/context/overlaps";
import { estimateTextRenderWidth, normalizeTextRenderBounds } from "../src/context/text-rendering";

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

test("normalizeArrowGeometry fans multiple outgoing diamond arrows across distinct corners", () => {
  const normalized = normalizeArrowGeometry([
    { id: "decision", type: "diamond", x: 100, y: 100, width: 120, height: 120 },
    { id: "yes", type: "rectangle", x: 300, y: 120, width: 140, height: 80 },
    { id: "no", type: "rectangle", x: 90, y: 300, width: 140, height: 80 },
    {
      id: "arrow_yes",
      type: "arrow",
      x: 220,
      y: 160,
      width: 80,
      height: 0,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "yes" },
    },
    {
      id: "arrow_no",
      type: "arrow",
      x: 160,
      y: 220,
      width: 0,
      height: 80,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "no" },
    },
  ]) as Record<string, unknown>[];

  const yes = normalized.find((element) => element.id === "arrow_yes")!;
  const no = normalized.find((element) => element.id === "arrow_no")!;
  assert.deepEqual([yes.x, yes.y], [220, 160]);
  assert.deepEqual([no.x, no.y], [160, 220]);
  assert.notDeepEqual([yes.x, yes.y], [no.x, no.y]);
});

test("normalizeArrowGeometry separates same-side outgoing diamond arrows", () => {
  const normalized = normalizeArrowGeometry([
    { id: "decision", type: "diamond", x: 100, y: 100, width: 120, height: 120 },
    { id: "retry", type: "rectangle", x: 320, y: 80, width: 140, height: 80 },
    { id: "continue", type: "rectangle", x: 320, y: 210, width: 140, height: 80 },
    {
      id: "arrow_retry",
      type: "arrow",
      x: 220,
      y: 160,
      width: 100,
      height: -20,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "retry" },
    },
    {
      id: "arrow_continue",
      type: "arrow",
      x: 220,
      y: 160,
      width: 100,
      height: 80,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "continue" },
    },
  ]) as Record<string, unknown>[];

  const retry = normalized.find((element) => element.id === "arrow_retry")!;
  const next = normalized.find((element) => element.id === "arrow_continue")!;
  assert.deepEqual([retry.x, retry.y], [220, 160]);
  assert.deepEqual([next.x, next.y], [160, 100]);
});

test("normalizeArrowGeometry routes diamond arrows around blocking shapes with an elbow", () => {
  const normalized = normalizeArrowGeometry([
    { id: "decision", type: "diamond", x: 100, y: 100, width: 120, height: 120 },
    { id: "blocker", type: "rectangle", x: 240, y: 135, width: 80, height: 70 },
    { id: "target", type: "rectangle", x: 360, y: 120, width: 140, height: 80 },
    {
      id: "arrow_decision_target",
      type: "arrow",
      x: 220,
      y: 160,
      width: 140,
      height: 0,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "target" },
    },
  ]) as Record<string, unknown>[];

  const arrow = normalized.find((element) => element.id === "arrow_decision_target")!;
  assert.deepEqual(arrow.points, [
    [0, 0],
    [70, -61],
    [140, 0],
  ]);
});

test("normalizeArrowGeometry lands diamond return arrow at the entry side of the target, not the exit side", () => {
  // prev → check → decision → check (loop back)
  // The return arrow should end where prev→check ends (top of check), not where check→decision starts (bottom of check)
  const normalized = normalizeArrowGeometry([
    { id: "prev", type: "rectangle", x: 100, y: 100, width: 200, height: 80 },
    { id: "check", type: "rectangle", x: 100, y: 240, width: 200, height: 80 },
    { id: "decision", type: "diamond", x: 140, y: 380, width: 120, height: 120 },
    {
      id: "arrow_prev_check",
      type: "arrow",
      x: 200,
      y: 180,
      width: 0,
      height: 60,
      startBinding: { elementId: "prev" },
      endBinding: { elementId: "check" },
    },
    {
      id: "arrow_check_decision",
      type: "arrow",
      x: 200,
      y: 320,
      width: 0,
      height: 60,
      startBinding: { elementId: "check" },
      endBinding: { elementId: "decision" },
    },
    {
      id: "arrow_decision_check",
      type: "arrow",
      x: 200,
      y: 380,
      width: -60,
      height: -140,
      startBinding: { elementId: "decision" },
      endBinding: { elementId: "check" },
    },
  ]) as Record<string, unknown>[];

  const prevToCheck = normalized.find((e) => e.id === "arrow_prev_check")!;
  const returnArrow = normalized.find((e) => e.id === "arrow_decision_check")!;

  // Both should land at the top of check (y=240)
  const prevToCheckEndY = (prevToCheck.y as number) + ((prevToCheck.points as number[][])[1]![1] as number);
  const returnEndY = (returnArrow.y as number) + ((returnArrow.points as number[][]).at(-1)![1] as number);
  assert.equal(returnEndY, 240);
  assert.equal(returnEndY, prevToCheckEndY);
});

test("normalizeArrowGeometry curves diamond return arrows away from the forward arrow", () => {
  const normalized = normalizeArrowGeometry([
    { id: "bake", type: "rectangle", x: 100, y: 100, width: 240, height: 100 },
    { id: "done", type: "diamond", x: 440, y: 90, width: 120, height: 120 },
    {
      id: "arrow_bake_done",
      type: "arrow",
      x: 340,
      y: 150,
      width: 100,
      height: 0,
      startBinding: { elementId: "bake" },
      endBinding: { elementId: "done" },
    },
    {
      id: "arrow_done_bake",
      type: "arrow",
      x: 440,
      y: 150,
      width: -100,
      height: 0,
      startBinding: { elementId: "done" },
      endBinding: { elementId: "bake" },
    },
  ]) as Record<string, unknown>[];

  const forward = normalized.find((element) => element.id === "arrow_bake_done")!;
  const back = normalized.find((element) => element.id === "arrow_done_bake")!;

  assert.deepEqual(forward.points, [
    [0, 0],
    [100, 0],
  ]);
  assert.deepEqual(back.points, [
    [0, 0],
    [0, -96],
    [-100, -96],
    [-100, 0],
  ]);
  assert.deepEqual(back.roundness, { type: 2 });
});

test("normalizeArrowGeometry anchors diagonal arrows between non aligned shapes", () => {
  const normalized = normalizeArrowGeometry([
    { id: "ellipse_ocean", type: "ellipse", x: 100, y: 260, width: 180, height: 120 },
    { id: "ellipse_evaporation", type: "ellipse", x: 520, y: 80, width: 200, height: 120 },
    {
      id: "arrow_ocean_evaporation",
      type: "arrow",
      x: 260,
      y: 210,
      width: 40,
      height: 0,
      points: [
        [0, 0],
        [40, 0],
      ],
      startBinding: { elementId: "ellipse_ocean" },
      endBinding: { elementId: "ellipse_evaporation" },
    },
  ]) as Record<string, unknown>[];

  const arrow = normalized.find((element) => element.id === "arrow_ocean_evaporation")!;

  assert.equal(arrow.x, 280);
  assert.equal(arrow.y, 320);
  assert.equal(arrow.width, 240);
  assert.equal(arrow.height, -180);
  assert.deepEqual(arrow.points, [
    [0, 0],
    [240, -180],
  ]);
  assert.deepEqual((arrow as { startBinding?: unknown }).startBinding, { elementId: "ellipse_ocean", focus: 0, gap: 1 });
  assert.deepEqual((arrow as { endBinding?: unknown }).endBinding, { elementId: "ellipse_evaporation", focus: 0, gap: 1 });
});

function normalizeArrowLabels(elements: Record<string, unknown>[]): Record<string, unknown>[] {
  return normalizeArrowLabelPlacement(
    normalizeArrowGeometry(
      normalizeArrowLabelClearance(normalizeTextRenderBounds(elements))
    )
  ) as Record<string, unknown>[];
}

test("findArrowLabelClearanceRisks reports labels that do not fit between connected shapes", () => {
  const risks = findArrowLabelClearanceRisks([
    { id: "rect_evaporation", type: "rectangle", x: 100, y: 100, width: 160, height: 80 },
    { id: "rect_condensation", type: "rectangle", x: 320, y: 100, width: 160, height: 80 },
    {
      id: "arrow_evaporation_condensation",
      type: "arrow",
      x: 260,
      y: 140,
      width: 60,
      height: 0,
      startBinding: { elementId: "rect_evaporation" },
      endBinding: { elementId: "rect_condensation" },
    },
    {
      id: "arrow_evaporation_condensation_label",
      type: "text",
      x: 260,
      y: 125,
      width: 160,
      height: 30,
      text: "water goes up",
      containerId: "arrow_evaporation_condensation",
    },
  ]);

  assert.deepEqual(
    risks.map((risk) => [risk.arrowId, risk.labelId, risk.axis]),
    [["arrow_evaporation_condensation", "arrow_evaporation_condensation_label", "horizontal"]]
  );
  assert.equal(Math.round(risks[0]!.gap), 60);
  assert.equal(Math.round(risks[0]!.requiredGap), 176);
});

test("normalizeArrowLabelClearance opens spacing and keeps arrow labels clear of shapes", () => {
  const normalized = normalizeArrowLabels([
    { id: "rect_evaporation", type: "rectangle", x: 100, y: 100, width: 160, height: 80 },
    {
      id: "rect_evaporation_label",
      type: "text",
      x: 100,
      y: 100,
      width: 160,
      height: 80,
      text: "Evaporation",
      containerId: "rect_evaporation",
    },
    { id: "rect_condensation", type: "rectangle", x: 320, y: 100, width: 160, height: 80 },
    {
      id: "rect_condensation_label",
      type: "text",
      x: 320,
      y: 100,
      width: 160,
      height: 80,
      text: "Condensation",
      containerId: "rect_condensation",
    },
    {
      id: "arrow_evaporation_condensation",
      type: "arrow",
      x: 260,
      y: 140,
      width: 60,
      height: 0,
      startBinding: { elementId: "rect_evaporation" },
      endBinding: { elementId: "rect_condensation" },
    },
    {
      id: "arrow_evaporation_condensation_label",
      type: "text",
      x: 260,
      y: 125,
      width: 60,
      height: 30,
      text: "water goes up",
      containerId: "arrow_evaporation_condensation",
    },
  ]);

  const source = normalized.find((element) => element.id === "rect_evaporation")!;
  const target = normalized.find((element) => element.id === "rect_condensation")!;
  const targetLabel = normalized.find((element) => element.id === "rect_condensation_label")!;
  const arrow = normalized.find((element) => element.id === "arrow_evaporation_condensation")!;
  const arrowLabel = normalized.find((element) => element.id === "arrow_evaporation_condensation_label")!;
  const sourceEdgeX = (source.x as number) + (source.width as number);
  const gap = (target.x as number) - sourceEdgeX;
  const expectedMidpointX = sourceEdgeX + gap / 2;
  const targetLabelExpectedX =
    (target.x as number) + 5 + (((target.width as number) - 10) / 2 - (targetLabel.width as number) / 2);

  assert.ok(gap >= estimateTextRenderWidth("water goes up", 20) + 32);
  assert.equal(targetLabel.x, targetLabelExpectedX);
  assert.equal(arrow.x, sourceEdgeX);
  assert.equal(arrow.y, 140);
  assert.equal(arrow.width, gap);
  assert.equal(arrow.height, 0);
  assert.deepEqual(arrow.points, [
    [0, 0],
    [gap, 0],
  ]);
  assert.deepEqual((arrow as { startBinding?: unknown }).startBinding, { elementId: "rect_evaporation", focus: 0, gap: 1 });
  assert.deepEqual((arrow as { endBinding?: unknown }).endBinding, { elementId: "rect_condensation", focus: 0, gap: 1 });
  assert.equal(
    (arrowLabel.x as number) + (arrowLabel.width as number) / 2,
    expectedMidpointX
  );
  assert.deepEqual(findOverlaps(normalized), []);
  assert.deepEqual(findArrowLabelClearanceRisks(normalized), []);
});

test("arrow label clearance normalization is idempotent", () => {
  const first = normalizeArrowLabels([
    { id: "rect_a", type: "rectangle", x: 100, y: 100, width: 160, height: 80 },
    { id: "rect_b", type: "rectangle", x: 320, y: 100, width: 160, height: 80 },
    {
      id: "arrow_a_b",
      type: "arrow",
      x: 260,
      y: 140,
      width: 60,
      height: 0,
      startBinding: { elementId: "rect_a" },
      endBinding: { elementId: "rect_b" },
    },
    {
      id: "arrow_a_b_label",
      type: "text",
      x: 260,
      y: 125,
      width: 60,
      height: 30,
      text: "water goes up",
      containerId: "arrow_a_b",
    },
  ]);
  const second = normalizeArrowLabels(first);

  assert.deepEqual(second, first);
});
