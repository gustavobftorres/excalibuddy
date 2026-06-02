interface TextLike {
  id?: unknown;
  type?: unknown;
  x?: unknown;
  width?: unknown;
  height?: unknown;
  text?: unknown;
  fontSize?: unknown;
  textAlign?: unknown;
  containerId?: unknown;
  customData?: unknown;
}

export interface LabelRenderRisk {
  id: string;
  text: string;
  width: number;
  requiredWidth: number;
  missingWidth: number;
  containerId?: string;
}

type UpdateElement = (element: unknown, updates: Record<string, unknown>) => unknown;

const HORIZONTAL_PADDING = 8;
const AVERAGE_CHAR_WIDTH_RATIO = 0.62;
const MIN_SAFE_TEXT_WIDTH = 16;

function getCustomData(el: TextLike): Record<string, unknown> {
  return el.customData && typeof el.customData === "object"
    ? (el.customData as Record<string, unknown>)
    : {};
}

function getText(el: TextLike): string | null {
  return typeof el.text === "string" && el.text.trim() ? el.text : null;
}

function getFontSize(el: TextLike): number {
  return typeof el.fontSize === "number" && el.fontSize > 0 ? el.fontSize : 20;
}

function getTextAlign(el: TextLike): "left" | "center" | "right" {
  return el.textAlign === "right" || el.textAlign === "center" || el.textAlign === "left"
    ? el.textAlign
    : "center";
}

export function estimateTextRenderWidth(text: string, fontSize = 20): number {
  const longestLine = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  return Math.max(MIN_SAFE_TEXT_WIDTH, longestLine * fontSize * AVERAGE_CHAR_WIDTH_RATIO);
}

function normalizeTextElement(el: TextLike, updateElement: UpdateElement): unknown {
  const text = getText(el);
  if (
    el.type !== "text" ||
    !text ||
    typeof el.x !== "number" ||
    typeof el.width !== "number"
  ) {
    return el;
  }

  const customData = getCustomData(el);
  if (customData.textRenderBoundsNormalized === true) {
    return el;
  }

  const requiredWidth = estimateTextRenderWidth(text, getFontSize(el)) + HORIZONTAL_PADDING * 2;
  const width = Math.max(el.width, requiredWidth);
  const delta = width - el.width;
  const align = getTextAlign(el);
  const x =
    align === "center"
      ? el.x - delta / 2
      : align === "right"
        ? el.x - delta
        : el.x;

  return updateElement(el, {
    x,
    width,
    customData: {
      ...customData,
      textRenderBoundsNormalized: true,
      textRenderPadding: HORIZONTAL_PADDING,
    },
  });
}

export function normalizeTextRenderBounds<T extends readonly unknown[]>(
  elements: T,
  updateElement: UpdateElement = (element, updates) => ({
    ...(element as Record<string, unknown>),
    ...updates,
  })
): T {
  return elements.map((element) => normalizeTextElement(element as TextLike, updateElement)) as unknown as T;
}

export function findLabelRenderRisks(elements: unknown[]): LabelRenderRisk[] {
  if (!Array.isArray(elements)) return [];

  const risks: LabelRenderRisk[] = [];
  for (const element of elements) {
    const el = element as TextLike;
    const text = getText(el);
    if (
      el.type !== "text" ||
      !text ||
      typeof el.id !== "string" ||
      typeof el.width !== "number"
    ) {
      continue;
    }

    const requiredWidth = estimateTextRenderWidth(text, getFontSize(el)) + HORIZONTAL_PADDING * 2;
    if (el.width + 0.5 >= requiredWidth) continue;

    risks.push({
      id: el.id,
      text,
      width: el.width,
      requiredWidth,
      missingWidth: requiredWidth - el.width,
      ...(typeof el.containerId === "string" ? { containerId: el.containerId } : {}),
    });
  }

  return risks;
}
