import test from "node:test";
import assert from "node:assert/strict";

import { buildWebSearchPrepareStep } from "../src/agent-core";

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
  const prepareStep = buildWebSearchPrepareStep(true);

  assert.equal(
    prepareStep?.({
      steps: [{} as never],
      stepNumber: 1,
      model: {} as never,
      messages: [],
      experimental_context: undefined,
    }),
    undefined
  );
});

test("buildWebSearchPrepareStep is disabled when web search is not required", () => {
  assert.equal(buildWebSearchPrepareStep(false), undefined);
});
