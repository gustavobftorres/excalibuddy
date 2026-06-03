import test from "node:test";
import assert from "node:assert/strict";

import { cascadeRemoveElements } from "../src/context/remove-elements";

test("cascadeRemoveElements removes a shape together with its bound label", () => {
  const next = cascadeRemoveElements(
    [
      {
        id: "rect_login",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 200,
        height: 80,
        boundElements: [{ id: "rect_login_label", type: "text" }],
      },
      {
        id: "rect_login_label",
        type: "text",
        x: 100,
        y: 100,
        width: 200,
        height: 80,
        text: "Login",
        containerId: "rect_login",
      },
      {
        id: "rect_db",
        type: "rectangle",
        x: 420,
        y: 100,
        width: 200,
        height: 80,
      },
    ],
    ["rect_login"]
  );

  assert.deepEqual(
    next.map((element) => element.id),
    ["rect_db"]
  );
});

test("cascadeRemoveElements removes an arrow together with its bound label", () => {
  const next = cascadeRemoveElements(
    [
      {
        id: "arrow_login_db",
        type: "arrow",
        x: 300,
        y: 130,
        width: 120,
        height: 0,
        boundElements: [{ id: "arrow_login_db_label", type: "text" }],
      },
      {
        id: "arrow_login_db_label",
        type: "text",
        x: 300,
        y: 130,
        width: 120,
        height: 24,
        text: "calls",
        containerId: "arrow_login_db",
      },
      {
        id: "rect_db",
        type: "rectangle",
        x: 420,
        y: 100,
        width: 200,
        height: 80,
      },
    ],
    ["arrow_login_db"]
  );

  assert.deepEqual(
    next.map((element) => element.id),
    ["rect_db"]
  );
});
