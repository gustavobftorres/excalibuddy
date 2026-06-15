import test from "node:test";
import assert from "node:assert/strict";

import { SYSTEM_PROMPT } from "../src/agent-core";
import { buildTools } from "../src/tools";

test("system prompt forbids deleting arrows to repair canvas hygiene", () => {
  assert.match(
    SYSTEM_PROMPT,
    /Do NOT use `removeElements` to fix overlaps, arrow path obstacles, clipped labels, or disconnected diagrams/
  );
  assert.match(
    SYSTEM_PROMPT,
    /`arrowPathObstacles` array listing arrows that cross unrelated shapes/
  );
  assert.doesNotMatch(
    SYSTEM_PROMPT,
    /If it returns issues, fix them with `updateElements`, `addElements`, or `removeElements`/
  );
});

test("system prompt limits web search to one call per turn", () => {
  assert.match(
    SYSTEM_PROMPT,
    /When Search web is enabled, call `searchWeb` once at the start of the turn/
  );
  assert.match(
    SYSTEM_PROMPT,
    /Do not call `searchWeb` again for visual canvas corrections/
  );
});

test("removeElements tool description is explicitly delete-only", () => {
  const tools = buildTools({});

  assert.match(
    tools.removeElements.description ?? "",
    /Only use this when the user explicitly asks to delete or remove elements/
  );
  assert.match(
    tools.removeElements.description ?? "",
    /Do not use this to fix overlaps, arrow crossings, routing problems, or disconnected diagrams/
  );
});
