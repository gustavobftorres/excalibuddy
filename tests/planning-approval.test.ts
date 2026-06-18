import test from "node:test";
import assert from "node:assert/strict";

import { buildApprovePlanCommand } from "../src/planning/approval";

const plan = {
  title: "OAuth authorization code flow",
  summary: "Show the browser, app, auth server, and resource server.",
  steps: [
    "Place the browser and web app on the left.",
    "Show the auth server and resource server on the right.",
  ],
  assumptions: ["Use the standard web app variant."],
  questions: [],
};

test("buildApprovePlanCommand returns an implement_plan command for a valid plan", () => {
  const result = buildApprovePlanCommand({
    plan,
    planId: "tool-plan-1",
    originalPrompt: "Create an OAuth authorization code flow diagram",
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail(result.reason);

  assert.equal(result.command.type, "agent.command");
  assert.equal(result.command.command, "implement_plan");
  assert.equal(result.command.payload.planId, "tool-plan-1");
  assert.equal(result.command.payload.source, "approve_plan_button");
  assert.match(
    result.command.payload.prompt,
    /The user approved the plan below\. Build the diagram now\./
  );
});

test("buildApprovePlanCommand rejects a missing plan", () => {
  const result = buildApprovePlanCommand({
    plan: null,
    planId: "tool-plan-1",
    originalPrompt: "Create an OAuth authorization code flow diagram",
  });

  assert.deepEqual(result, { ok: false, reason: "No active plan to approve." });
});

test("buildApprovePlanCommand rejects a missing plan id", () => {
  const result = buildApprovePlanCommand({
    plan,
    planId: null,
    originalPrompt: "Create an OAuth authorization code flow diagram",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Cannot approve this plan because its id is missing.",
  });
});

test("buildApprovePlanCommand rejects a missing original prompt", () => {
  const result = buildApprovePlanCommand({
    plan,
    planId: "tool-plan-1",
    originalPrompt: "   ",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Cannot start implementation because the original request is missing.",
  });
});

test("buildApprovePlanCommand rejects an incomplete streamed plan payload", () => {
  const result = buildApprovePlanCommand({
    plan: {
      title: "OAuth authorization code flow",
      summary: "Show the main actors.",
    },
    planId: "tool-plan-1",
    originalPrompt: "Create an OAuth authorization code flow diagram",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Cannot approve this plan because it is incomplete.",
  });
});
