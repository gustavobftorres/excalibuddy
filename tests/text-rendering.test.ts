import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateTextRenderWidth,
  findLabelRenderRisks,
  normalizeTextRenderBounds,
} from "../src/context/text-rendering";

test("findLabelRenderRisks ignores text that fits its bounds", () => {
  const width = estimateTextRenderWidth("Short label", 20) + 28;

  const risks = findLabelRenderRisks([
    { id: "label", type: "text", text: "Short label", width, fontSize: 20 },
  ]);

  assert.deepEqual(risks, []);
});

test("findLabelRenderRisks reports text with insufficient width", () => {
  const risks = findLabelRenderRisks([
    {
      id: "label",
      type: "text",
      text: "Authentication Service",
      width: 80,
      fontSize: 20,
      containerId: "rect_auth",
    },
  ]);

  assert.equal(risks.length, 1);
  assert.equal(risks[0]?.id, "label");
  assert.equal(risks[0]?.containerId, "rect_auth");
  assert.ok((risks[0]?.missingWidth ?? 0) > 0);
});

test("normalizeTextRenderBounds pads centered text symmetrically and is idempotent", () => {
  const [first] = normalizeTextRenderBounds([
    { id: "label", type: "text", x: 100, width: 40, text: "Some text", textAlign: "center" },
  ]) as Record<string, unknown>[];

  assert.equal(typeof first.x, "number");
  assert.equal(typeof first.width, "number");
  assert.ok((first.x as number) < 100);
  assert.ok((first.width as number) > 40);

  const [second] = normalizeTextRenderBounds([first]) as Record<string, unknown>[];
  assert.equal(second.x, first.x);
  assert.equal(second.width, first.width);
});

test("normalizeTextRenderBounds preserves left aligned x", () => {
  const [element] = normalizeTextRenderBounds([
    { id: "label", type: "text", x: 100, width: 40, text: "Some text", textAlign: "left" },
  ]) as Record<string, unknown>[];

  assert.equal(element.x, 100);
  assert.ok((element.width as number) > 40);
});

test("normalizeTextRenderBounds preserves right aligned right edge", () => {
  const [element] = normalizeTextRenderBounds([
    { id: "label", type: "text", x: 100, width: 40, text: "Some text", textAlign: "right" },
  ]) as Record<string, unknown>[];

  assert.equal((element.x as number) + (element.width as number), 140);
  assert.ok((element.width as number) > 40);
});

test("normalizeTextRenderBounds handles bound labels and standalone text", () => {
  const normalized = normalizeTextRenderBounds([
    { id: "rect", type: "rectangle", x: 100, y: 100, width: 80, height: 80 },
    {
      id: "rect_label",
      type: "text",
      x: 100,
      y: 100,
      width: 40,
      height: 80,
      text: "Database Cluster",
      containerId: "rect",
    },
    { id: "note", type: "text", x: 100, y: 220, width: 30, height: 40, text: "Note" },
  ]) as Record<string, unknown>[];

  assert.equal(normalized[0]?.width, 80);
  assert.ok((normalized[1]?.width as number) > 40);
  assert.ok((normalized[2]?.width as number) > 30);
});
