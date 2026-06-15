import test from "node:test";
import assert from "node:assert/strict";

import {
  deferClientToolExecution,
  getClientToolErrorMessage,
} from "../src/client-tool-scheduling";

test("deferClientToolExecution resolves only after the scheduled callback runs", async () => {
  const callbacks: (() => void)[] = [];
  let resolved = false;

  const deferred = deferClientToolExecution((callback) => {
    callbacks.push(callback);
  }).then(() => {
    resolved = true;
  });

  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(callbacks.length, 1);

  callbacks[0]?.();
  await deferred;
  assert.equal(resolved, true);
});

test("getClientToolErrorMessage preserves Error messages", () => {
  assert.equal(getClientToolErrorMessage(new Error("boom")), "boom");
  assert.equal(getClientToolErrorMessage("boom"), "Client tool execution failed");
});
