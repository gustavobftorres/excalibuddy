import test from "node:test";
import assert from "node:assert/strict";

import {
  createElementCountNotifier,
  getVisibleElementCount,
} from "../src/components/canvas-element-count";

test("getVisibleElementCount ignores deleted elements", () => {
  assert.equal(
    getVisibleElementCount([
      { isDeleted: false },
      { isDeleted: true },
      {},
    ]),
    2
  );
});

test("createElementCountNotifier only notifies when the count changes", () => {
  const calls: number[] = [];
  const notify = createElementCountNotifier((count) => calls.push(count));

  notify(3);
  notify(3);
  notify(4);
  notify(4);
  notify(3);

  assert.deepEqual(calls, [3, 4, 3]);
});
