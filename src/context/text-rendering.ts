interface TextLike {
  id?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  text?: unknown;
  fontSize?: unknown;
  textAlign?: unknown;
  verticalAlign?: unknown;
  containerId?: unknown;
  customData?: unknown;
}

interface ShapeLike {
  id?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
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
const BOUND_TEXT_PADDING = 5;
const AVERAGE_CHAR_WIDTH_RATIO = 0.62;
const MIN_SAFE_TEXT_WIDTH = 16;
const CONTAINER_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

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

function estimateLongestWordRenderWidth(text: string, fontSize = 20): number {
  const longestWord = text
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, word.length), 0);
  return Math.max(MIN_SAFE_TEXT_WIDTH, longestWord * fontSize * AVERAGE_CHAR_WIDTH_RATIO);
}

function requiredUnbrokenTextWidth(text: string, fontSize = 20): number {
  return estimateLongestWordRenderWidth(text, fontSize) + HORIZONTAL_PADDING * 2;
}

function requiredTextRenderBoundsWidth(text: string, fontSize = 20): number {
  return estimateTextRenderWidth(text, fontSize) + HORIZONTAL_PADDING * 2;
}

function isContainerShape(el: ShapeLike): boolean {
  return (
    typeof el.id === "string" &&
    typeof el.type === "string" &&
    CONTAINER_TYPES.has(el.type) &&
    typeof el.x === "number" &&
    typeof el.y === "number" &&
    typeof el.width === "number" &&
    typeof el.height === "number"
  );
}

function getBoundTextContainerCoords(shape: ShapeLike): { x: number; y: number } | null {
  if (
    typeof shape.x !== "number" ||
    typeof shape.y !== "number" ||
    typeof shape.width !== "number" ||
    typeof shape.height !== "number"
  ) {
    return null;
  }

  let offsetX = BOUND_TEXT_PADDING;
  let offsetY = BOUND_TEXT_PADDING;
  if (shape.type === "ellipse") {
    offsetX += (shape.width / 2) * (1 - Math.sqrt(2) / 2);
    offsetY += (shape.height / 2) * (1 - Math.sqrt(2) / 2);
  }
  if (shape.type === "diamond") {
    offsetX += shape.width / 4;
    offsetY += shape.height / 4;
  }
  return { x: shape.x + offsetX, y: shape.y + offsetY };
}

function getBoundTextMaxWidth(shape: ShapeLike): number | null {
  if (typeof shape.width !== "number") return null;
  if (shape.type === "ellipse") {
    return Math.round((shape.width / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
  }
  if (shape.type === "diamond") {
    return Math.round(shape.width / 2) - BOUND_TEXT_PADDING * 2;
  }
  return shape.width - BOUND_TEXT_PADDING * 2;
}

function getBoundTextMaxHeight(shape: ShapeLike): number | null {
  if (typeof shape.height !== "number") return null;
  if (shape.type === "ellipse") {
    return Math.round((shape.height / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
  }
  if (shape.type === "diamond") {
    return Math.round(shape.height / 2) - BOUND_TEXT_PADDING * 2;
  }
  return shape.height - BOUND_TEXT_PADDING * 2;
}

function requiredContainerWidthForBoundText(requiredTextWidth: number, containerType: unknown): number {
  const padding = BOUND_TEXT_PADDING * 2;
  if (containerType === "ellipse") {
    return Math.round(((requiredTextWidth + padding) / Math.sqrt(2)) * 2);
  }
  if (containerType === "diamond") {
    return 2 * (requiredTextWidth + padding);
  }
  return requiredTextWidth + padding;
}

function boundShapeTextPosition(label: TextLike, shape: ShapeLike): { x: number; y: number } | null {
  if (typeof label.width !== "number" || typeof label.height !== "number") return null;
  const coords = getBoundTextContainerCoords(shape);
  const maxWidth = getBoundTextMaxWidth(shape);
  const maxHeight = getBoundTextMaxHeight(shape);
  if (!coords || maxWidth === null || maxHeight === null) return null;

  return {
    x: coords.x + (maxWidth / 2 - label.width / 2),
    y: coords.y + (maxHeight / 2 - label.height / 2),
  };
}

function normalizeWidth(
  el: TextLike,
  requiredWidth: number,
  updateElement: UpdateElement
): unknown {
  if (typeof el.x !== "number" || typeof el.width !== "number") return el;

  const width = Math.max(el.width, requiredWidth);
  const delta = width - el.width;
  if (delta <= 0) return el;

  const align = getTextAlign(el);
  const x =
    align === "center"
      ? el.x - delta / 2
      : align === "right"
        ? el.x - delta
        : el.x;

  return updateElement(el, { x, width });
}

function normalizeTextElement(
  el: TextLike,
  requiredWidth: number,
  forceContainerCentering: boolean,
  updateElement: UpdateElement,
  containerShape?: ShapeLike
): unknown {
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
  const centeringUpdates =
    forceContainerCentering &&
    (el.textAlign !== "center" || el.verticalAlign !== "middle")
      ? { textAlign: "center", verticalAlign: "middle" }
      : {};

  if (
    customData.textRenderBoundsNormalized === true &&
    Object.keys(centeringUpdates).length === 0 &&
    !containerShape
  ) {
    return el;
  }

  const normalized = (
    containerShape
      ? updateElement(el, { width: requiredWidth })
      : normalizeWidth(el, requiredWidth, updateElement)
  ) as TextLike;
  const position = containerShape ? boundShapeTextPosition(normalized, containerShape) : null;

  return updateElement(normalized, {
    ...(position ?? {}),
    ...centeringUpdates,
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
  const containerWidthById = new Map<string, number>();
  const shapeContainerIds = new Set<string>();

  for (const element of elements) {
    const shape = element as ShapeLike;
    if (isContainerShape(shape)) shapeContainerIds.add(shape.id as string);
  }

  for (const element of elements) {
    const el = element as TextLike;
    const text = getText(el);
    if (el.type !== "text" || !text || typeof el.containerId !== "string") continue;
    const requiredWidth = requiredUnbrokenTextWidth(text, getFontSize(el));
    const shape = elements.find(
      (element) => (element as ShapeLike).id === el.containerId
    ) as ShapeLike | undefined;
    const requiredContainerWidth =
      shape && isContainerShape(shape)
        ? requiredContainerWidthForBoundText(requiredWidth, shape.type)
        : requiredWidth;
    containerWidthById.set(
      el.containerId,
      Math.max(containerWidthById.get(el.containerId) ?? 0, requiredContainerWidth)
    );
  }

  const normalizedContainers = elements.map((element) => {
    const shape = element as ShapeLike;
    if (!isContainerShape(shape)) return element;
    const requiredWidth = containerWidthById.get(shape.id);
    if (!requiredWidth || shape.width >= requiredWidth) return element;
    const delta = requiredWidth - shape.width;
    return updateElement(element, {
      x: shape.x - delta / 2,
      width: requiredWidth,
    });
  });

  const shapeById = new Map<string, ShapeLike>();
  for (const element of normalizedContainers) {
    const shape = element as ShapeLike;
    if (isContainerShape(shape)) shapeById.set(shape.id as string, shape);
  }

  return normalizedContainers.map((element) => {
    const el = element as TextLike;
    const text = getText(el);
    if (el.type === "text" && text) {
      const containerShape =
        typeof el.containerId === "string" ? shapeById.get(el.containerId) : undefined;
      return normalizeTextElement(
        el,
        requiredTextRenderBoundsWidth(text, getFontSize(el)),
        typeof el.containerId === "string" && shapeContainerIds.has(el.containerId),
        updateElement,
        containerShape
      );
    }

    return element;
  }) as unknown as T;
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

    const requiredWidth = requiredTextRenderBoundsWidth(text, getFontSize(el));
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
