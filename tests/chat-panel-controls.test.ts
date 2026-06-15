import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ChatToolToggle from "../src/components/chat/ChatToolToggle";
import { TooltipProvider } from "../src/components/ui/tooltip";

test("ChatPanel renders planning and web search as icon tooltip buttons", () => {
  const html = renderToStaticMarkup(
    React.createElement(TooltipProvider, null, React.createElement("div", null, [
      React.createElement(ChatToolToggle, {
        key: "planning",
        label: "Planning mode",
        tooltip: "Plan before drawing",
        active: true,
        disabled: false,
        onToggle: () => undefined,
        icon: React.createElement("svg", { className: "test-icon" }),
      }),
      React.createElement(ChatToolToggle, {
        key: "web",
        label: "Search web",
        tooltip: "Search the web before generating",
        active: true,
        disabled: false,
        onToggle: () => undefined,
        icon: React.createElement("svg", { className: "test-icon" }),
      }),
    ]))
  );

  assert.match(html, /aria-label="Planning mode enabled"/);
  assert.match(html, /aria-label="Search web enabled"/);
  assert.match(html, /chat-tool-button-icon/);
  assert.match(html, /Plan before drawing/);
  assert.match(html, /Search the web before generating/);
  assert.doesNotMatch(html, /role="switch"/);
  assert.doesNotMatch(html, /chat-switch/);
});
