import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateRecords,
  buildRegressionCases,
} from "../scripts/flywheel-utils.mjs";

test("buildCandidateRecords selects feedback, error, latency, tool-heavy, and unusual prompt traces", () => {
  const rows = [
    {
      id: "thumb-down",
      input: { userInput: "Draw auth" },
      output: { finalText: "Done", toolCalls: [] },
      scores: { user_feedback: 0 },
      comment: "bad",
      metadata: { sessionId: "s1" },
      metrics: { latencyMs: 100 },
    },
    {
      id: "boring",
      input: { userInput: "Draw box" },
      output: { finalText: "Done", toolCalls: [] },
      scores: { user_feedback: 1 },
      metadata: {},
      metrics: { latencyMs: 100 },
    },
    {
      id: "tool-heavy",
      input: { userInput: "Draw a very detailed system with many services" },
      output: { finalText: "Done", toolCalls: new Array(7).fill({ name: "addElements" }) },
      scores: { user_feedback: 1 },
      metadata: {},
      metrics: { latencyMs: 100 },
    },
    {
      id: "slow",
      input: { userInput: "Draw slow" },
      output: { finalText: "Done", toolCalls: [] },
      scores: {},
      metadata: {},
      metrics: { latencyMs: 25_000 },
    },
  ];

  const candidates = buildCandidateRecords(rows, {
    latencyThresholdMs: 20_000,
    promptLengthThreshold: 40,
    toolCallThreshold: 6,
  });

  assert.deepEqual(candidates.map((candidate) => candidate.sourceTraceId), [
    "thumb-down",
    "tool-heavy",
    "slow",
  ]);
  assert.deepEqual(candidates[0]?.reasons, ["thumbs_down"]);
  assert.deepEqual(candidates[1]?.reasons, ["unusual_prompt", "many_tool_calls"]);
  assert.deepEqual(candidates[2]?.reasons, ["high_latency"]);
});

test("buildRegressionCases converts reviewed candidates to GoldenTestCase-compatible cases", () => {
  const cases = buildRegressionCases([
    {
      sourceTraceId: "trace-1",
      userInput: "Draw a login flow",
      finalText: "Done",
      toolCalls: [{ name: "addElements" }],
      feedback: "thumbs_down",
      comment: "missing error path",
      reasons: ["thumbs_down"],
      suggested: {
        id: "flywheel-login-flow",
        expectedCharacteristics: ["Includes valid and invalid branches"],
        expectedKeywords: ["login", "error"],
        difficulty: "medium",
        category: "create",
        reviewNotes: "Regression for missing invalid branch",
      },
    },
  ]);

  assert.deepEqual(cases, [
    {
      id: "flywheel-login-flow",
      input: "Draw a login flow",
      expectedCharacteristics: ["Includes valid and invalid branches"],
      expectedKeywords: ["login", "error"],
      difficulty: "medium",
      category: "create",
      sourceTraceId: "trace-1",
      feedback: "thumbs_down",
      reviewNotes: "Regression for missing invalid branch",
    },
  ]);
});
