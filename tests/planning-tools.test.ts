import test from "node:test";
import assert from "node:assert/strict";

import { buildPlanningTools, buildTools } from "../src/tools";

test("planning tools expose plan approval but no canvas mutation tools", () => {
  const planningTools = buildPlanningTools({});

  assert.ok("requestPlanApproval" in planningTools);
  assert.equal("addElements" in planningTools, false);
  assert.equal("updateElements" in planningTools, false);
  assert.equal("removeElements" in planningTools, false);
  assert.equal("queryCanvas" in planningTools, false);
});

test("build tools still expose the canvas mutators", () => {
  const buildModeTools = buildTools({});

  assert.ok("addElements" in buildModeTools);
  assert.ok("updateElements" in buildModeTools);
  assert.ok("removeElements" in buildModeTools);
  assert.ok("queryCanvas" in buildModeTools);
});
