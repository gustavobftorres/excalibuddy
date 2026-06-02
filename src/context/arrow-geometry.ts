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

type Direction = "right" | "down" | "left" | "up";
type DiamondVertex = Direction;

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
const ROUTE_CLEARANCE = 36;

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

function dominantDirection(from: ShapeBox, toward: ShapeBox): Direction {
  const a = center(from);
  const b = center(toward);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function diamondPoint(shape: ShapeBox, vertex: DiamondVertex): Point {
  const c = center(shape);
  switch (vertex) {
    case "right":
      return { x: shape.x + shape.width, y: c.y };
    case "down":
      return { x: c.x, y: shape.y + shape.height };
    case "left":
      return { x: shape.x, y: c.y };
    case "up":
      return { x: c.x, y: shape.y };
  }
}

function diamondVertexCandidates(direction: Direction): DiamondVertex[] {
  switch (direction) {
    case "right":
      return ["right", "up", "down", "left"];
    case "down":
      return ["down", "right", "left", "up"];
    case "left":
      return ["left", "up", "down", "right"];
    case "up":
      return ["up", "right", "left", "down"];
  }
}

function directionalConnectionPoint(shape: ShapeBox, toward: ShapeBox): Point {
  const direction = dominantDirection(shape, toward);
  if (shape.type === "diamond") return diamondPoint(shape, direction);
  const c = center(shape);
  switch (direction) {
    case "right":
      return { x: shape.x + shape.width, y: c.y };
    case "down":
      return { x: c.x, y: shape.y + shape.height };
    case "left":
      return { x: shape.x, y: c.y };
    case "up":
      return { x: c.x, y: shape.y };
  }
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

function shapeBounds(shape: ShapeBox) {
  return {
    left: Math.min(shape.x, shape.x + shape.width),
    right: Math.max(shape.x, shape.x + shape.width),
    top: Math.min(shape.y, shape.y + shape.height),
    bottom: Math.max(shape.y, shape.y + shape.height),
  };
}

function segmentIntersectsShape(a: Point, b: Point, shape: ShapeBox): boolean {
  const bounds = shapeBounds(shape);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, a.x - bounds.left) &&
    clip(dx, bounds.right - a.x) &&
    clip(-dy, a.y - bounds.top) &&
    clip(dy, bounds.bottom - a.y) &&
    t1 > 0 &&
    t0 < 1
  );
}

function blockingShapes(
  start: Point,
  end: Point,
  shapes: Iterable<ShapeBox>,
  startId: string,
  endId: string
): ShapeBox[] {
  const blockers: ShapeBox[] = [];
  for (const shape of shapes) {
    if (shape.id === startId || shape.id === endId) continue;
    if (segmentIntersectsShape(start, end, shape)) blockers.push(shape);
  }
  return blockers;
}

function routeAroundShapes(
  start: Point,
  end: Point,
  shapes: Iterable<ShapeBox>,
  startId: string,
  endId: string
): Point[] {
  const blockers = blockingShapes(start, end, shapes, startId, endId);
  if (blockers.length === 0) return [start, end];

  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  if (horizontal) {
    const top = Math.min(...blockers.map((shape) => shapeBounds(shape).top)) - ROUTE_CLEARANCE;
    const bottom =
      Math.max(...blockers.map((shape) => shapeBounds(shape).bottom)) + ROUTE_CLEARANCE;
    const y = Math.abs(start.y - top) <= Math.abs(start.y - bottom) ? top : bottom;
    return [start, { x: start.x + (end.x - start.x) / 2, y }, end];
  }

  const left = Math.min(...blockers.map((shape) => shapeBounds(shape).left)) - ROUTE_CLEARANCE;
  const right = Math.max(...blockers.map((shape) => shapeBounds(shape).right)) + ROUTE_CLEARANCE;
  const x = Math.abs(start.x - left) <= Math.abs(start.x - right) ? left : right;
  return [start, { x, y: start.y + (end.y - start.y) / 2 }, end];
}

function routeAroundReciprocalPair(start: Point, end: Point, startShape: ShapeBox, endShape: ShapeBox): Point[] {
  const startBounds = shapeBounds(startShape);
  const endBounds = shapeBounds(endShape);
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

  if (horizontal) {
    const top = Math.min(startBounds.top, endBounds.top) - ROUTE_CLEARANCE;
    const bottom = Math.max(startBounds.bottom, endBounds.bottom) + ROUTE_CLEARANCE;
    const y = Math.abs(start.y - top) <= Math.abs(start.y - bottom) ? top : bottom;
    return [start, { x: start.x, y }, { x: end.x, y }, end];
  }

  const left = Math.min(startBounds.left, endBounds.left) - ROUTE_CLEARANCE;
  const right = Math.max(startBounds.right, endBounds.right) + ROUTE_CLEARANCE;
  const x = Math.abs(start.x - left) <= Math.abs(start.x - right) ? left : right;
  return [start, { x, y: start.y }, { x, y: end.y }, end];
}

function relativePoints(origin: Point, points: Point[]): number[][] {
  return points.map((point) => [point.x - origin.x, point.y - origin.y]);
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

function diamondAnchorAssignments(
  elements: readonly unknown[],
  shapes: Map<string, ShapeBox>
): Map<string, { start?: Point; end?: Point }> {
  const assignments = new Map<string, { start?: Point; end?: Point }>();
  const nextSlot = new Map<string, number>();

  const assign = (
    arrowId: string,
    role: "start" | "end",
    diamond: ShapeBox,
    toward: ShapeBox
  ) => {
    const direction = dominantDirection(diamond, toward);
    const key = `${diamond.id}:${role}:${direction}`;
    const slot = nextSlot.get(key) ?? 0;
    nextSlot.set(key, slot + 1);
    const candidates = diamondVertexCandidates(direction);
    const point = diamondPoint(diamond, candidates[slot % candidates.length]!);
    const current = assignments.get(arrowId) ?? {};
    assignments.set(arrowId, { ...current, [role]: point });
  };

  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow" || typeof arrow.id !== "string") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;
    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) continue;
    if (startShape.type === "diamond") assign(arrow.id, "start", startShape, endShape);
    if (endShape.type === "diamond") assign(arrow.id, "end", endShape, startShape);
  }

  return assignments;
}

function incomingNonDiamondSources(
  elements: readonly unknown[],
  shapes: Map<string, ShapeBox>
): Map<string, ShapeBox> {
  const incoming = new Map<string, ShapeBox>();
  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;
    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) continue;
    if (startShape.type !== "diamond") incoming.set(endId, startShape);
  }
  return incoming;
}

function reciprocalDiamondReturnIds(
  elements: readonly unknown[],
  shapes: Map<string, ShapeBox>
): Set<string> {
  const arrowsByPair = new Set<string>();
  const arrowBindings: { id: string; startId: string; endId: string }[] = [];

  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow" || typeof arrow.id !== "string") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;
    arrowsByPair.add(`${startId}->${endId}`);
    arrowBindings.push({ id: arrow.id, startId, endId });
  }

  const out = new Set<string>();
  for (const arrow of arrowBindings) {
    const startShape = shapes.get(arrow.startId);
    if (startShape?.type !== "diamond") continue;
    if (arrowsByPair.has(`${arrow.endId}->${arrow.startId}`)) out.add(arrow.id);
  }

  return out;
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
  const diamondAnchors = diamondAnchorAssignments(elements, shapes);
  const reciprocalReturns = reciprocalDiamondReturnIds(elements, shapes);
  const incomingSources = incomingNonDiamondSources(elements, shapes);

  return elements.map((element) => {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow") return element;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) return element;
    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) return element;
    const axis = getAxis(startShape, endShape);
    const hasDiamond = startShape.type === "diamond" || endShape.type === "diamond";
    if (!axis && !hasDiamond) return element;

    const anchors = typeof arrow.id === "string" ? diamondAnchors.get(arrow.id) : undefined;
    const start =
      anchors?.start ??
      (axis ? connectionPoint(startShape, axis, endShape) : directionalConnectionPoint(startShape, endShape));
    const endRef =
      (startShape.type === "diamond" ? incomingSources.get(endId) : undefined) ?? startShape;
    const end =
      anchors?.end ??
      (axis ? connectionPoint(endShape, axis, endRef) : directionalConnectionPoint(endShape, endRef));
    const points = reciprocalReturns.has(arrow.id as string)
      ? routeAroundReciprocalPair(start, end, startShape, endShape)
      : hasDiamond
        ? routeAroundShapes(start, end, shapes.values(), startId, endId)
        : [start, end];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return updateElement(element, {
      x: start.x,
      y: start.y,
      width: dx,
      height: dy,
      points: relativePoints(start, points),
      ...(points.length > 2 ? { roundness: { type: 2 } } : {}),
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
