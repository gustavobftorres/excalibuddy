import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PlanApprovalCard from "../src/components/hitl/PlanApprovalCard";

test("PlanApprovalCard renders collapsed summary state by default", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlanApprovalCard, {
      plan: {
        title: "OAuth authorization code flow",
        summary: "Show browser, app, auth server, and resource server.",
        steps: ["Place actors left to right", "Draw the redirect and token exchange"],
        assumptions: ["Use the standard browser-based app"],
        questions: [],
      },
    })
  );

  assert.match(html, /OAuth authorization code flow/);
  assert.match(html, /Planning phase/);
  assert.doesNotMatch(html, /Build steps/);
});
