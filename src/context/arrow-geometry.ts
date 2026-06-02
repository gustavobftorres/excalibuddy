interface ElementLike {
  id?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  points?: unknown;
  startBinding?: ArrowBinding | null;
  endBinding?: ArrowBinding | null;
  customData?: unknown;
}

interface ArrowBinding {
  elementId?: unknown;
  focus?: unknown;
  gap?: unknown;
}

interface Point {
  x: number;
  y: number;
}

interface ShapeBox {
  id: string;
  type: "rectangle" | "ellipse" | "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UnboundArrowRisk {
  id: string;
  reason: "missing_start" | "missing_end" | "missing_target";
  startId?: string;
  endId?: string;
}

export interface ArrowAnchorRisk {
  id: string;
  reason: "endpoint_mismatch" | "binding_mismatch";
  startId: string;
  endId: string;
  axis: "horizontal" | "vertical";
  expectedStart: Point;
  expectedEnd: Point;
  actualStart: Point;
  actualEnd: Point;
}

type UpdateElement = (element: unknown, updates: Record<string, unknown>) => unknown;

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const AXIS_ALIGNMENT_TOLERANCE = 24;
const ANCHOR_TOLERANCE = 10;
const BINDING_TOLERANCE = 0.001;
const EDGE_CENTER_BINDING_GAP = 1;

function isShape(el: ElementLike): el is ShapeBox {
  return (
    typeof el.id === "string" &&
    typeof el.type === "string" &&
    SHAPE_TYPES.has(el.type) &&
    typeof el.x === "number" &&
    typeof el.y === "number" &&
    typeof el.width === "number" &&
    typeof el.height === "number"
  );
}

function center(shape: ShapeBox): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function shapeById(elements: unknown[]): Map<string, ShapeBox> {
  const out = new Map<string, ShapeBox>();
  for (const element of elements) {
    const el = element as ElementLike;
    if (isShape(el)) out.set(el.id, el);
  }
  return out;
}

function getBindingIds(arrow: ElementLike): { startId?: string; endId?: string } {
  const startId = arrow.startBinding?.elementId;
  const endId = arrow.endBinding?.elementId;
  return {
    ...(typeof startId === "string" ? { startId } : {}),
    ...(typeof endId === "string" ? { endId } : {}),
  };
}

function getAxis(start: ShapeBox, end: ShapeBox): "horizontal" | "vertical" | null {
  const a = center(start);
  const b = center(end);
  if (Math.abs(a.x - b.x) <= AXIS_ALIGNMENT_TOLERANCE) return "vertical";
  if (Math.abs(a.y - b.y) <= AXIS_ALIGNMENT_TOLERANCE) return "horizontal";
  return null;
}

function connectionPoint(shape: ShapeBox, axis: "horizontal" | "vertical", toward: ShapeBox): Point {
  const from = center(shape);
  const to = center(toward);
  if (axis === "vertical") {
    return {
      x: from.x,
      y: to.y >= from.y ? shape.y + shape.height : shape.y,
    };
  }
  return {
    x: to.x >= from.x ? shape.x + shape.width : shape.x,
    y: from.y,
  };
}

function getArrowEndpoints(arrow: ElementLike): { start: Point; end: Point } | null {
  if (typeof arrow.x !== "number" || typeof arrow.y !== "number") return null;

  if (Array.isArray(arrow.points) && arrow.points.length >= 2) {
    const first = arrow.points[0] as unknown[];
    const last = arrow.points[arrow.points.length - 1] as unknown[];
    if (
      Array.isArray(first) &&
      Array.isArray(last) &&
      typeof first[0] === "number" &&
      typeof first[1] === "number" &&
      typeof last[0] === "number" &&
      typeof last[1] === "number"
    ) {
      return {
        start: { x: arrow.x + first[0], y: arrow.y + first[1] },
        end: { x: arrow.x + last[0], y: arrow.y + last[1] },
      };
    }
  }

  if (typeof arrow.width !== "number" || typeof arrow.height !== "number") return null;
  return {
    start: { x: arrow.x, y: arrow.y },
    end: { x: arrow.x + arrow.width, y: arrow.y + arrow.height },
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isStableCenterBinding(binding: ArrowBinding | null | undefined): boolean {
  return (
    typeof binding?.focus === "number" &&
    Math.abs(binding.focus) <= BINDING_TOLERANCE &&
    typeof binding.gap === "number" &&
    binding.gap >= EDGE_CENTER_BINDING_GAP
  );
}

function centeredBinding(elementId: string): ArrowBinding {
  return { elementId, focus: 0, gap: EDGE_CENTER_BINDING_GAP };
}

export function findUnboundArrows(elements: unknown[]): UnboundArrowRisk[] {
  const shapes = shapeById(elements);
  const risks: UnboundArrowRisk[] = [];

  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow" || typeof arrow.id !== "string") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId) {
      risks.push({ id: arrow.id, reason: "missing_start", endId });
      continue;
    }
    if (!endId) {
      risks.push({ id: arrow.id, reason: "missing_end", startId });
      continue;
    }
    if (!shapes.has(startId) || !shapes.has(endId)) {
      risks.push({ id: arrow.id, reason: "missing_target", startId, endId });
    }
  }

  return risks;
}

export function findArrowAnchorRisks(elements: unknown[]): ArrowAnchorRisk[] {
  const shapes = shapeById(elements);
  const risks: ArrowAnchorRisk[] = [];

  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow" || typeof arrow.id !== "string") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;
    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) continue;
    const axis = getAxis(startShape, endShape);
    if (!axis) continue;

    const endpoints = getArrowEndpoints(arrow);
    if (!endpoints) continue;
    const expectedStart = connectionPoint(startShape, axis, endShape);
    const expectedEnd = connectionPoint(endShape, axis, startShape);
    const endpointMismatch =
      distance(endpoints.start, expectedStart) > ANCHOR_TOLERANCE ||
      distance(endpoints.end, expectedEnd) > ANCHOR_TOLERANCE;
    const bindingMismatch =
      !isStableCenterBinding(arrow.startBinding) ||
      !isStableCenterBinding(arrow.endBinding);

    if (
      endpointMismatch ||
      bindingMismatch
    ) {
      risks.push({
        id: arrow.id,
        reason: endpointMismatch ? "endpoint_mismatch" : "binding_mismatch",
        startId,
        endId,
        axis,
        expectedStart,
        expectedEnd,
        actualStart: endpoints.start,
        actualEnd: endpoints.end,
      });
    }
  }

  return risks;
}

export function normalizeArrowGeometry<T extends readonly unknown[]>(
  elements: T,
  updateElement: UpdateElement = (element, updates) => ({
    ...(element as Record<string, unknown>),
    ...updates,
  })
): T {
  const shapes = shapeById(elements as unknown[]);

  return elements.map((element) => {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow") return element;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) return element;
    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) return element;
    const axis = getAxis(startShape, endShape);
    if (!axis) return element;

    const start = connectionPoint(startShape, axis, endShape);
    const end = connectionPoint(endShape, axis, startShape);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return updateElement(element, {
      x: start.x,
      y: start.y,
      width: dx,
      height: dy,
      points: [
        [0, 0],
        [dx, dy],
      ],
      startBinding: centeredBinding(startId),
      endBinding: centeredBinding(endId),
      customData: {
        ...((arrow.customData && typeof arrow.customData === "object"
          ? arrow.customData
          : {}) as Record<string, unknown>),
        arrowGeometryNormalized: true,
      },
    });
  }) as unknown as T;
}
