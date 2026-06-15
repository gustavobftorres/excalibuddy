import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentRequestBody,
  buildApprovedPlanPrompt,
  shouldStartInPlanningMode,
} from "../src/planning/session";

test("shouldStartInPlanningMode is true for a first-turn create flow on an empty canvas", () => {
  assert.equal(
    shouldStartInPlanningMode({
      planningModeEnabled: true,
      sceneElementCount: 0,
      hasPriorAssistantMessages: false,
      pendingPlanApproval: false,
    }),
    true
  );
});

test("shouldStartInPlanningMode stays true on an empty canvas even after earlier assistant messages", () => {
  assert.equal(
    shouldStartInPlanningMode({
      planningModeEnabled: true,
      sceneElementCount: 0,
      hasPriorAssistantMessages: true,
      pendingPlanApproval: false,
    }),
    true
  );
});

test("shouldStartInPlanningMode is false when the canvas already has elements", () => {
  assert.equal(
    shouldStartInPlanningMode({
      planningModeEnabled: true,
      sceneElementCount: 3,
      hasPriorAssistantMessages: false,
      pendingPlanApproval: false,
    }),
    false
  );
});

test("shouldStartInPlanningMode is false while a plan is already awaiting approval", () => {
  assert.equal(
    shouldStartInPlanningMode({
      planningModeEnabled: true,
      sceneElementCount: 0,
      hasPriorAssistantMessages: false,
      pendingPlanApproval: true,
    }),
    false
  );
});

test("shouldStartInPlanningMode is false when the user disables planning mode", () => {
  assert.equal(
    shouldStartInPlanningMode({
      planningModeEnabled: false,
      sceneElementCount: 0,
      hasPriorAssistantMessages: false,
      pendingPlanApproval: false,
    }),
    false
  );
});

test("buildApprovedPlanPrompt embeds the user request and the approved steps", () => {
  const prompt = buildApprovedPlanPrompt({
    originalPrompt: "Create an OAuth authorization code flow diagram",
    plan: {
      title: "OAuth authorization code flow",
      summary: "Show the browser, app, auth server, and resource server.",
      steps: [
        "Place the browser and web app on the left.",
        "Show the auth server and resource server on the right.",
      ],
      assumptions: ["Use the standard web app variant."],
      questions: [],
    },
  });

  assert.match(prompt, /Original request: Create an OAuth authorization code flow diagram/);
  assert.match(prompt, /Approved plan:/);
  assert.match(prompt, /1\. Place the browser and web app on the left\./);
});

test("buildAgentRequestBody uses the per-turn mode over stale React state", () => {
  assert.deepEqual(
    buildAgentRequestBody({
      sessionId: "session-1",
      turnId: "turn-1",
      assistantMessageId: "assistant-1",
      requestedMode: "planning",
      planningModeEnabled: false,
      webSearchEnabled: false,
      currentAgentMode: "build",
    }),
    {
      sessionId: "session-1",
      turnId: "turn-1",
      assistantMessageId: "assistant-1",
      mode: "planning",
      webSearchEnabled: false,
    }
  );
});

test("buildAgentRequestBody includes the per-turn web search preference", () => {
  assert.deepEqual(
    buildAgentRequestBody({
      sessionId: "session-1",
      planningModeEnabled: false,
      webSearchEnabled: true,
      currentAgentMode: "build",
    }),
    {
      sessionId: "session-1",
      turnId: undefined,
      assistantMessageId: undefined,
      mode: "build",
      webSearchEnabled: true,
    }
  );
});
