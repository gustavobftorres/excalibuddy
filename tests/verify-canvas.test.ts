import test from "node:test";
import assert from "node:assert/strict";

import { hasConnectivityIntent, verifyCanvasElements } from "../src/context/verify-canvas";

test("verifyCanvasElements reports deterministic canvas hygiene issues", () => {
  const result = verifyCanvasElements({
    userRequest: "Draw a flow from Login to API to Database",
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
      { id: "label_db", type: "text", text: "Database Cluster", x: 400, y: 20, width: 40, height: 30 },
    ],
  });

  assert.equal(result.passed, false);
  assert.equal(result.summary.overlaps, 1);
  assert.equal(result.summary.disconnectedShapes, 1);
  assert.equal(result.summary.riskyLabels, 1);
  assert.deepEqual(
    result.issues.map((issue) => issue.kind),
    ["overlap", "risky_label", "arrow_anchor", "disconnected_shape"]
  );
});

test("verifyCanvasElements skips connectivity for non relational requests", () => {
  const result = verifyCanvasElements({
    userRequest: "Draw a circle and a square next to each other",
    elements: [
      { id: "ellipse_a", type: "ellipse", x: 0, y: 0, width: 120, height: 120 },
      { id: "rect_b", type: "rectangle", x: 220, y: 0, width: 120, height: 120 },
    ],
  });

  assert.equal(result.passed, true);
  assert.equal(result.summary.disconnectedShapes, 0);
  assert.equal(result.issues.some((issue) => issue.kind === "disconnected_shape"), false);
});

test("hasConnectivityIntent does not treat Process label edits as connected requests", () => {
  assert.equal(hasConnectivityIntent("rename the Process box to Validate"), false);
  assert.equal(
    hasConnectivityIntent("Draw a simple flowchart with Start, Process, and End boxes connected by arrows"),
    true
  );
});
