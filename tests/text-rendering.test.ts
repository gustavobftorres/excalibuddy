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

test("findLabelRenderRisks reports labels whose full line would be clipped", () => {
  const risks = findLabelRenderRisks([
    {
      id: "label",
      type: "text",
      text: "Pour into pan",
      width: 110,
      fontSize: 20,
    },
  ]);

  assert.equal(risks.length, 1);
  assert.equal(risks[0]?.id, "label");
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

test("normalizeTextRenderBounds grows text bounds to fit the full rendered line", () => {
  const [element] = normalizeTextRenderBounds([
    {
      id: "label",
      type: "text",
      x: 100,
      width: 110,
      text: "Pour into pan",
      fontSize: 20,
      textAlign: "center",
    },
  ]) as Record<string, unknown>[];

  const safeWidth = estimateTextRenderWidth("Pour into pan", 20) + 16;
  assert.ok((element.width as number) >= safeWidth);
  assert.equal((element.x as number) + (element.width as number) / 2, 155);
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

  assert.ok((normalized[0]?.width as number) > 80);
  assert.ok((normalized[1]?.width as number) > 40);
  assert.ok((normalized[2]?.width as number) > 30);
});

test("normalizeTextRenderBounds explicitly centers labels bound to shapes", () => {
  const normalized = normalizeTextRenderBounds([
    { id: "rect", type: "rectangle", x: 100, y: 100, width: 220, height: 100 },
    {
      id: "rect_label",
      type: "text",
      x: 100,
      y: 100,
      width: 220,
      height: 100,
      text: "Precipitation\n(rain / snow)",
      containerId: "rect",
    },
    { id: "arrow", type: "arrow", x: 320, y: 150, width: 80, height: 0 },
    {
      id: "arrow_label",
      type: "text",
      x: 320,
      y: 150,
      width: 80,
      height: 30,
      text: "water goes up",
      containerId: "arrow",
    },
  ]) as Record<string, unknown>[];

  const shapeLabel = normalized.find((element) => element.id === "rect_label")!;
  const arrowLabel = normalized.find((element) => element.id === "arrow_label")!;

  assert.equal(shapeLabel.textAlign, "center");
  assert.equal(shapeLabel.verticalAlign, "middle");
  assert.equal(arrowLabel.verticalAlign, undefined);
});

test("normalizeTextRenderBounds positions ellipse labels using Excalidraw bound text geometry", () => {
  const normalized = normalizeTextRenderBounds([
    { id: "ellipse_runoff", type: "ellipse", x: 100, y: 100, width: 160, height: 160 },
    {
      id: "ellipse_runoff_label",
      type: "text",
      x: 100,
      y: 100,
      width: 160,
      height: 30,
      text: "Runoff",
      fontSize: 20,
      containerId: "ellipse_runoff",
    },
  ]) as Record<string, unknown>[];

  const label = normalized.find((element) => element.id === "ellipse_runoff_label")!;
  const expectedWidth = estimateTextRenderWidth("Runoff", 20) + 16;
  const inset = 5 + (160 / 2) * (1 - Math.sqrt(2) / 2);
  const maxWidth = Math.round((160 / 2) * Math.sqrt(2)) - 10;
  const maxHeight = Math.round((160 / 2) * Math.sqrt(2)) - 10;

  assert.equal(label.textAlign, "center");
  assert.equal(label.verticalAlign, "middle");
  assert.equal(label.width, expectedWidth);
  assert.equal(label.x, 100 + inset + (maxWidth / 2 - expectedWidth / 2));
  assert.equal(label.y, 100 + inset + (maxHeight / 2 - 30 / 2));
});

test("normalizeTextRenderBounds positions diamond labels using Excalidraw bound text geometry", () => {
  const normalized = normalizeTextRenderBounds([
    { id: "diamond_decision", type: "diamond", x: 100, y: 100, width: 160, height: 120 },
    {
      id: "diamond_decision_label",
      type: "text",
      x: 100,
      y: 100,
      width: 160,
      height: 30,
      text: "Cooked?",
      fontSize: 20,
      containerId: "diamond_decision",
    },
  ]) as Record<string, unknown>[];

  const diamond = normalized.find((element) => element.id === "diamond_decision")!;
  const label = normalized.find((element) => element.id === "diamond_decision_label")!;
  const expectedWidth = estimateTextRenderWidth("Cooked?", 20) + 16;
  const diamondX = diamond.x as number;
  const diamondY = diamond.y as number;
  const diamondWidth = diamond.width as number;
  const diamondHeight = diamond.height as number;

  assert.equal(label.x, diamondX + 5 + diamondWidth / 4 + ((Math.round(diamondWidth / 2) - 10) / 2 - expectedWidth / 2));
  assert.equal(label.y, diamondY + 5 + diamondHeight / 4 + ((Math.round(diamondHeight / 2) - 10) / 2 - 30 / 2));
});

test("findLabelRenderRisks reports labels whose longest word cannot fit", () => {
  const risks = findLabelRenderRisks([
    {
      id: "decision_label",
      type: "text",
      text: "Cooked?",
      width: 60,
      height: 40,
      fontSize: 20,
      containerId: "decision",
    },
  ]);

  assert.equal(risks.length, 1);
  assert.equal(risks[0]?.id, "decision_label");
});

test("normalizeTextRenderBounds grows a diamond container so a bound word stays whole", () => {
  const normalized = normalizeTextRenderBounds([
    { id: "decision", type: "diamond", x: 100, y: 100, width: 60, height: 80 },
    {
      id: "decision_label",
      type: "text",
      x: 100,
      y: 100,
      width: 60,
      height: 80,
      text: "Cooked?",
      fontSize: 20,
      containerId: "decision",
    },
  ]) as Record<string, unknown>[];

  const diamond = normalized.find((element) => element.id === "decision")!;
  const label = normalized.find((element) => element.id === "decision_label")!;
  const safeWidth = estimateTextRenderWidth("Cooked?", 20) + 16;

  assert.ok((diamond.width as number) >= safeWidth);
  assert.ok((label.width as number) >= safeWidth);
  assert.equal((diamond.x as number) + (diamond.width as number) / 2, 130);
});
