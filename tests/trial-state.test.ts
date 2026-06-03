import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRIAL_STATE,
  PROMPT_LIMIT,
  getTrialStateFromStorage,
  recordTrialPrompt,
  shouldBlockAgentPrompts,
} from "../src/trial-state";

test("getTrialStateFromStorage returns the default state when storage is empty", () => {
  assert.deepEqual(getTrialStateFromStorage(null), DEFAULT_TRIAL_STATE);
});

test("getTrialStateFromStorage falls back to the default state for invalid JSON", () => {
  assert.deepEqual(getTrialStateFromStorage("{not-json"), DEFAULT_TRIAL_STATE);
});

test("getTrialStateFromStorage normalizes stored values", () => {
  assert.deepEqual(
    getTrialStateFromStorage(JSON.stringify({ promptCount: -4, trialEnded: "yes" })),
    DEFAULT_TRIAL_STATE
  );

  assert.deepEqual(
    getTrialStateFromStorage(JSON.stringify({ promptCount: 3.8, trialEnded: false })),
    { promptCount: 3, trialEnded: false }
  );
});

test("recordTrialPrompt increments the prompt count before the limit", () => {
  assert.deepEqual(recordTrialPrompt({ promptCount: 2, trialEnded: false }), {
    promptCount: 3,
    trialEnded: false,
  });
});

test("recordTrialPrompt ends the trial as soon as the prompt limit is reached", () => {
  const state = recordTrialPrompt({ promptCount: PROMPT_LIMIT - 1, trialEnded: false });

  assert.deepEqual(state, {
    promptCount: PROMPT_LIMIT,
    trialEnded: true,
  });
  assert.equal(shouldBlockAgentPrompts(state), true);
});

test("recordTrialPrompt does not increment once the trial has ended", () => {
  const ended = { promptCount: PROMPT_LIMIT, trialEnded: true };

  assert.deepEqual(recordTrialPrompt(ended), ended);
});
