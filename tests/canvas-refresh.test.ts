import test from "node:test";
import assert from "node:assert/strict";

import { deferCanvasViewportRefresh } from "../src/canvas-refresh";

test("deferCanvasViewportRefresh does not refresh or scroll synchronously", async () => {
  const calls: string[] = [];
  const frames: (() => void)[] = [];
  const api = {
    refresh: () => calls.push("refresh"),
    scrollToContent: () => calls.push("scroll"),
  };

  const done = deferCanvasViewportRefresh(api, [{ id: "rect_a" }], {
    scheduleFrame: (callback) => {
      frames.push(callback);
    },
  });

  assert.deepEqual(calls, []);
  assert.equal(frames.length, 1);

  frames.shift()?.();
  await done;

  assert.deepEqual(calls, ["refresh", "scroll"]);
});
