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
  containerId?: unknown;
  text?: unknown;
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

export interface ArrowLabelClearanceRisk {
  arrowId: string;
  labelId: string;
  startId: string;
  endId: string;
  axis: "horizontal" | "vertical";
  gap: number;
  requiredGap: number;
  missingGap: number;
}

export interface ArrowPathObstacleRisk {
  arrowId: string;
  startId: string;
  endId: string;
  blockedBy: string[];
}

type UpdateElement = (element: unknown, updates: Record<string, unknown>) => unknown;

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const AXIS_ALIGNMENT_TOLERANCE = 24;
const ANCHOR_TOLERANCE = 10;
const BINDING_TOLERANCE = 0.001;
const EDGE_CENTER_BINDING_GAP = 1;
const ROUTE_CLEARANCE = 36;
const OUTER_ROUTE_CLEARANCE = 96;
const ARROW_LABEL_CLEARANCE_PADDING = 16;

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

function arrowLabelByContainerId(elements: unknown[]): Map<string, ElementLike> {
  const out = new Map<string, ElementLike>();
  const arrowIds = new Set<string>();

  for (const element of elements) {
    const el = element as ElementLike;
    if ((el.type === "arrow" || el.type === "line") && typeof el.id === "string") {
      arrowIds.add(el.id);
    }
  }

  for (const element of elements) {
    const el = element as ElementLike;
    if (
      el.type === "text" &&
      typeof el.id === "string" &&
      typeof el.containerId === "string" &&
      arrowIds.has(el.containerId) &&
      typeof el.x === "number" &&
      typeof el.y === "number" &&
      typeof el.width === "number" &&
      typeof el.height === "number"
    ) {
      out.set(el.containerId, el);
    }
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

function gapBetweenShapes(
  start: ShapeBox,
  end: ShapeBox,
  axis: "horizontal" | "vertical"
): number {
  if (axis === "horizontal") {
    return center(end).x >= center(start).x
      ? end.x - (start.x + start.width)
      : start.x - (end.x + end.width);
  }

  return center(end).y >= center(start).y
    ? end.y - (start.y + start.height)
    : start.y - (end.y + end.height);
}

function labelRequiredGap(label: ElementLike, axis: "horizontal" | "vertical"): number | null {
  const size = axis === "horizontal" ? label.width : label.height;
  return typeof size === "number" ? size + ARROW_LABEL_CLEARANCE_PADDING : null;
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

function routeBlockers(
  points: readonly Point[],
  shapes: Iterable<ShapeBox>,
  startId: string,
  endId: string
): ShapeBox[] {
  const blockers = new Map<string, ShapeBox>();
  for (let i = 0; i < points.length - 1; i++) {
    for (const blocker of blockingShapes(points[i]!, points[i + 1]!, shapes, startId, endId)) {
      blockers.set(blocker.id, blocker);
    }
  }
  return [...blockers.values()];
}

function routeHasBlockers(
  points: readonly Point[],
  shapes: Iterable<ShapeBox>,
  startId: string,
  endId: string
): boolean {
  return routeBlockers(points, shapes, startId, endId).length > 0;
}

function sortClosestFirst(values: [number, number], reference: number): [number, number] {
  return Math.abs(reference - values[0]) <= Math.abs(reference - values[1])
    ? values
    : [values[1], values[0]];
}

function externalRoutes(
  start: Point,
  end: Point,
  boundsSource: readonly ShapeBox[],
  horizontal: boolean
): Point[][] {
  if (boundsSource.length === 0) return [];

  if (horizontal) {
    const top =
      Math.min(...boundsSource.map((shape) => shapeBounds(shape).top)) - OUTER_ROUTE_CLEARANCE;
    const bottom =
      Math.max(...boundsSource.map((shape) => shapeBounds(shape).bottom)) + OUTER_ROUTE_CLEARANCE;
    return sortClosestFirst([top, bottom], start.y).map((y) => [
      start,
      { x: start.x, y },
      { x: end.x, y },
      end,
    ]);
  }

  const left =
    Math.min(...boundsSource.map((shape) => shapeBounds(shape).left)) - OUTER_ROUTE_CLEARANCE;
  const right =
    Math.max(...boundsSource.map((shape) => shapeBounds(shape).right)) + OUTER_ROUTE_CLEARANCE;
  return sortClosestFirst([left, right], start.x).map((x) => [
    start,
    { x, y: start.y },
    { x, y: end.y },
    end,
  ]);
}

function routeAroundShapes(
  start: Point,
  end: Point,
  shapes: Iterable<ShapeBox>,
  startId: string,
  endId: string,
  useExternalFallback = true
): Point[] {
  const shapeList = [...shapes];
  const blockers = blockingShapes(start, end, shapeList, startId, endId);
  if (blockers.length === 0) return [start, end];

  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  let shortRoute: Point[];
  if (horizontal) {
    const top = Math.min(...blockers.map((shape) => shapeBounds(shape).top)) - ROUTE_CLEARANCE;
    const bottom =
      Math.max(...blockers.map((shape) => shapeBounds(shape).bottom)) + ROUTE_CLEARANCE;
    const y = Math.abs(start.y - top) <= Math.abs(start.y - bottom) ? top : bottom;
    shortRoute = [start, { x: start.x + (end.x - start.x) / 2, y }, end];
  } else {
    const left = Math.min(...blockers.map((shape) => shapeBounds(shape).left)) - ROUTE_CLEARANCE;
    const right = Math.max(...blockers.map((shape) => shapeBounds(shape).right)) + ROUTE_CLEARANCE;
    const x = Math.abs(start.x - left) <= Math.abs(start.x - right) ? left : right;
    shortRoute = [start, { x, y: start.y + (end.y - start.y) / 2 }, end];
  }

  const shortRouteBlockers = routeBlockers(shortRoute, shapeList, startId, endId);
  if (shortRouteBlockers.length === 0 || !useExternalFallback) return shortRoute;

  const localBoundsSource = [...new Map([...blockers, ...shortRouteBlockers].map((shape) => [shape.id, shape])).values()];
  const candidates = [
    ...externalRoutes(start, end, localBoundsSource, horizontal),
    ...externalRoutes(
      start,
      end,
      shapeList.filter((shape) => shape.id !== startId && shape.id !== endId),
      horizontal
    ),
  ];
  return (
    candidates.find((candidate) => !routeHasBlockers(candidate, shapeList, startId, endId)) ??
    candidates[0] ??
    shortRoute
  );
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

export function findArrowLabelClearanceRisks(elements: unknown[]): ArrowLabelClearanceRisk[] {
  const shapes = shapeById(elements);
  const labelsByArrowId = arrowLabelByContainerId(elements);
  const risks: ArrowLabelClearanceRisk[] = [];

  for (const element of elements) {
    const arrow = element as ElementLike;
    if ((arrow.type !== "arrow" && arrow.type !== "line") || typeof arrow.id !== "string") {
      continue;
    }

    const label = labelsByArrowId.get(arrow.id);
    if (!label || typeof label.id !== "string") continue;

    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;

    const startShape = shapes.get(startId);
    const endShape = shapes.get(endId);
    if (!startShape || !endShape) continue;

    const axis = getAxis(startShape, endShape);
    if (!axis) continue;

    const requiredGap = labelRequiredGap(label, axis);
    if (requiredGap === null) continue;

    const gap = gapBetweenShapes(startShape, endShape, axis);
    const missingGap = requiredGap - gap;
    if (missingGap <= 0.5) continue;

    risks.push({
      arrowId: arrow.id,
      labelId: label.id,
      startId,
      endId,
      axis,
      gap,
      requiredGap,
      missingGap,
    });
  }

  return risks.sort((a, b) => a.arrowId.localeCompare(b.arrowId));
}

export function findArrowPathObstacleRisks(elements: unknown[]): ArrowPathObstacleRisk[] {
  const shapes = shapeById(elements);
  const risks: ArrowPathObstacleRisk[] = [];

  for (const element of elements) {
    const arrow = element as ElementLike;
    if (arrow.type !== "arrow" || typeof arrow.id !== "string") continue;
    const { startId, endId } = getBindingIds(arrow);
    if (!startId || !endId) continue;
    if (!shapes.has(startId) || !shapes.has(endId)) continue;

    const points = absoluteRoutePoints(arrow);
    if (!points || points.length < 2) continue;

    const blockedBy = new Set<string>();
    for (let i = 0; i < points.length - 1; i++) {
      for (const blocker of blockingShapes(points[i]!, points[i + 1]!, shapes.values(), startId, endId)) {
        blockedBy.add(blocker.id);
      }
    }

    if (blockedBy.size > 0) {
      risks.push({ arrowId: arrow.id, startId, endId, blockedBy: [...blockedBy].sort() });
    }
  }

  return risks.sort((a, b) => a.arrowId.localeCompare(b.arrowId));
}

function shiftElement(
  element: unknown,
  dx: number,
  dy: number,
  updateElement: UpdateElement
): unknown {
  const el = element as ElementLike;
  const updates: Record<string, unknown> = {};
  if (typeof el.x === "number") updates.x = el.x + dx;
  if (typeof el.y === "number") updates.y = el.y + dy;
  return Object.keys(updates).length > 0 ? updateElement(element, updates) : element;
}

function movedShapeIdsForRisk(elements: readonly unknown[], risk: ArrowLabelClearanceRisk): Set<string> {
  const shapes = shapeById(elements as unknown[]);
  const startShape = shapes.get(risk.startId);
  const endShape = shapes.get(risk.endId);
  if (!startShape || !endShape) return new Set();

  const startCenter = center(startShape);
  const endCenter = center(endShape);
  const movedIds = new Set<string>();

  for (const shape of shapes.values()) {
    const shapeCenter = center(shape);
    if (risk.axis === "horizontal") {
      if (
        (endCenter.x >= startCenter.x && shapeCenter.x >= endCenter.x) ||
        (endCenter.x < startCenter.x && shapeCenter.x <= endCenter.x)
      ) {
        movedIds.add(shape.id);
      }
      continue;
    }

    if (
      (endCenter.y >= startCenter.y && shapeCenter.y >= endCenter.y) ||
      (endCenter.y < startCenter.y && shapeCenter.y <= endCenter.y)
    ) {
      movedIds.add(shape.id);
    }
  }

  return movedIds;
}

function shouldMoveWithShapes(element: ElementLike, movedShapeIds: Set<string>): boolean {
  if (typeof element.id === "string" && movedShapeIds.has(element.id)) return true;
  return element.type === "text" && typeof element.containerId === "string" && movedShapeIds.has(element.containerId);
}

function normalizeOneArrowLabelClearancePass<T extends readonly unknown[]>(
  elements: T,
  updateElement: UpdateElement
): T {
  const risks = findArrowLabelClearanceRisks(elements as unknown[]);
  if (risks.length === 0) return elements;

  const risk = risks[0]!;
  const shapes = shapeById(elements as unknown[]);
  const startShape = shapes.get(risk.startId);
  const endShape = shapes.get(risk.endId);
  if (!startShape || !endShape) return elements;

  const delta = risk.missingGap;
  const startCenter = center(startShape);
  const endCenter = center(endShape);
  const dx =
    risk.axis === "horizontal" ? (endCenter.x >= startCenter.x ? delta : -delta) : 0;
  const dy = risk.axis === "vertical" ? (endCenter.y >= startCenter.y ? delta : -delta) : 0;
  const movedShapeIds = movedShapeIdsForRisk(elements, risk);

  return elements.map((element) =>
    shouldMoveWithShapes(element as ElementLike, movedShapeIds)
      ? shiftElement(element, dx, dy, updateElement)
      : element
  ) as unknown as T;
}

export function normalizeArrowLabelClearance<T extends readonly unknown[]>(
  elements: T,
  updateElement: UpdateElement = (element, updates) => ({
    ...(element as Record<string, unknown>),
    ...updates,
  })
): T {
  let current = elements;
  for (let i = 0; i < 20; i++) {
    const next = normalizeOneArrowLabelClearancePass(current, updateElement);
    if (next === current) return current;
    current = next;
  }
  return current;
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
        ? routeAroundShapes(start, end, shapes.values(), startId, endId, false)
        : routeAroundShapes(start, end, shapes.values(), startId, endId);
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

function absoluteRoutePoints(arrow: ElementLike): Point[] | null {
  if (typeof arrow.x !== "number" || typeof arrow.y !== "number") return null;

  if (Array.isArray(arrow.points) && arrow.points.length >= 2) {
    const points: Point[] = [];
    for (const raw of arrow.points) {
      const point = raw as unknown[];
      if (
        !Array.isArray(point) ||
        typeof point[0] !== "number" ||
        typeof point[1] !== "number"
      ) {
        return null;
      }
      points.push({ x: arrow.x + point[0], y: arrow.y + point[1] });
    }
    return points;
  }

  if (typeof arrow.width !== "number" || typeof arrow.height !== "number") return null;
  return [
    { x: arrow.x, y: arrow.y },
    { x: arrow.x + arrow.width, y: arrow.y + arrow.height },
  ];
}

function routeMidpoint(points: Point[]): Point {
  const segments: { start: Point; end: Point; length: number }[] = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    const length = distance(start, end);
    segments.push({ start, end, length });
    total += length;
  }

  if (total === 0) return points[0]!;

  let remaining = total / 2;
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const t = segment.length === 0 ? 0 : remaining / segment.length;
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * t,
      y: segment.start.y + (segment.end.y - segment.start.y) * t,
    };
  }

  return points.at(-1)!;
}

export function normalizeArrowLabelPlacement<T extends readonly unknown[]>(
  elements: T,
  updateElement: UpdateElement = (element, updates) => ({
    ...(element as Record<string, unknown>),
    ...updates,
  })
): T {
  const arrowById = new Map<string, ElementLike>();
  for (const element of elements) {
    const el = element as ElementLike;
    if ((el.type === "arrow" || el.type === "line") && typeof el.id === "string") {
      arrowById.set(el.id, el);
    }
  }

  return elements.map((element) => {
    const label = element as ElementLike;
    if (
      label.type !== "text" ||
      typeof label.containerId !== "string" ||
      typeof label.x !== "number" ||
      typeof label.y !== "number" ||
      typeof label.width !== "number" ||
      typeof label.height !== "number"
    ) {
      return element;
    }

    const arrow = arrowById.get(label.containerId);
    if (!arrow) return element;

    const points = absoluteRoutePoints(arrow);
    if (!points) return element;

    const midpoint = routeMidpoint(points);
    const x = midpoint.x - label.width / 2;
    const y = midpoint.y - label.height / 2;
    if (Math.abs(label.x - x) <= 0.5 && Math.abs(label.y - y) <= 0.5) return element;
    return updateElement(element, { x, y });
  }) as unknown as T;
}
