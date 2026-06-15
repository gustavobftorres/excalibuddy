import test from "node:test";
import assert from "node:assert/strict";

import { summarizeCanvasHygiene } from "../src/context/canvas-hygiene";

test("summarizeCanvasHygiene reports arrow path obstacles after mutations", () => {
  const summary = summarizeCanvasHygiene([
    { id: "rect_a", type: "rectangle", x: 0, y: 100, width: 100, height: 80 },
    { id: "rect_b", type: "rectangle", x: 180, y: 90, width: 100, height: 100 },
    { id: "rect_c", type: "rectangle", x: 360, y: 100, width: 100, height: 80 },
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
      startBinding: { elementId: "rect_a", focus: 0, gap: 1 },
      endBinding: { elementId: "rect_c", focus: 0, gap: 1 },
    },
  ]);

  assert.deepEqual(summary.overlaps, []);
  assert.deepEqual(summary.arrowPathObstacles, [
    {
      arrowId: "arrow_a_c",
      startId: "rect_a",
      endId: "rect_c",
      blockedBy: ["rect_b"],
    },
  ]);
});
