import test from "node:test";
import assert from "node:assert/strict";

import { buildWebSearchPrepareStep } from "../src/agent-core";
import { consumeWebSearchRequirement } from "../src/web-search-policy";

test("buildWebSearchPrepareStep forces searchWeb on the first step when required", () => {
  const prepareStep = buildWebSearchPrepareStep(true);

  assert.deepEqual(
    prepareStep?.({
      steps: [],
      stepNumber: 0,
      model: {} as never,
      messages: [],
      experimental_context: undefined,
    }),
    {
      toolChoice: { type: "tool", toolName: "searchWeb" },
      activeTools: ["searchWeb"],
    }
  );
});

test("buildWebSearchPrepareStep does not force tools after the first step", () => {
  const prepareStep = buildWebSearchPrepareStep(true, ["addElements", "verifyCanvas"]);

  assert.deepEqual(
    prepareStep?.({
      steps: [{} as never],
      stepNumber: 1,
      model: {} as never,
      messages: [],
      experimental_context: undefined,
    }),
    { activeTools: ["addElements", "verifyCanvas"] }
  );
});

test("buildWebSearchPrepareStep omits searchWeb from later active tools", () => {
  const prepareStep = buildWebSearchPrepareStep(true, [
    "addElements",
    "searchWeb",
    "verifyCanvas",
  ]);

  assert.deepEqual(
    prepareStep?.({
      steps: [{} as never],
      stepNumber: 1,
      model: {} as never,
      messages: [],
      experimental_context: undefined,
    }),
    { activeTools: ["addElements", "verifyCanvas"] }
  );
});

test("buildWebSearchPrepareStep is disabled when web search is not required", () => {
  assert.equal(buildWebSearchPrepareStep(false), undefined);
});

test("consumeWebSearchRequirement allows web search only once per turn", () => {
  const searchedTurnIds = new Set<string>();

  assert.equal(
    consumeWebSearchRequirement({ enabled: true, turnId: "turn_1", searchedTurnIds }),
    true
  );
  assert.equal(
    consumeWebSearchRequirement({ enabled: true, turnId: "turn_1", searchedTurnIds }),
    false
  );
  assert.equal(
    consumeWebSearchRequirement({ enabled: true, turnId: "turn_2", searchedTurnIds }),
    true
  );
});

test("consumeWebSearchRequirement does not consume disabled turns", () => {
  const searchedTurnIds = new Set<string>();

  assert.equal(
    consumeWebSearchRequirement({ enabled: false, turnId: "turn_1", searchedTurnIds }),
    false
  );
  assert.equal(
    consumeWebSearchRequirement({ enabled: true, turnId: "turn_1", searchedTurnIds }),
    true
  );
});
