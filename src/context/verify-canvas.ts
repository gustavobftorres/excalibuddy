import {
  findArrowAnchorRisks,
  findArrowLabelClearanceRisks,
  findArrowPathObstacleRisks,
  findUnboundArrows,
} from "./arrow-geometry";
import { findOverlaps } from "./overlaps";
import { findLabelRenderRisks } from "./text-rendering";

interface ElementLike {
  id?: unknown;
  type?: unknown;
  startBinding?: { elementId?: unknown } | null;
  endBinding?: { elementId?: unknown } | null;
}

export type CanvasIssueKind =
  | "overlap"
  | "risky_label"
  | "unbound_arrow"
  | "arrow_anchor"
  | "arrow_label_clearance"
  | "arrow_path_obstacle"
  | "disconnected_shape";

export interface CanvasIssue {
  kind: CanvasIssueKind;
  severity: "error" | "warning";
  elementIds: string[];
  message: string;
  suggestion: string;
  details?: Record<string, unknown>;
}

export interface CanvasVerificationResult {
  passed: boolean;
  connectivityRequired: boolean;
  summary: {
    overlaps: number;
    riskyLabels: number;
    unboundArrows: number;
    arrowAnchorRisks: number;
    arrowLabelClearanceRisks: number;
    arrowPathObstacleRisks: number;
    disconnectedShapes: number;
  };
  issues: CanvasIssue[];
}

const CONNECTED_HINTS = [
  "flow",
  "sequence",
  "between",
  "from",
  "pipeline",
  "chain",
  "architecture",
  "state machine",
  "network",
  "topology",
  "connected",
  "reports to",
  "routes to",
  "depends on",
];

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

export function hasConnectivityIntent(userRequest: string): boolean {
  const prompt = userRequest.toLowerCase();
  return CONNECTED_HINTS.some((hint) => prompt.includes(hint));
}

function getShapeIds(elements: unknown[]): string[] {
  return elements
    .map((element) => element as ElementLike)
    .filter((element) => typeof element.type === "string" && SHAPE_TYPES.has(element.type))
    .map((element) => (typeof element.id === "string" ? element.id : null))
    .filter((id): id is string => id !== null);
}

export function findDisconnectedShapeIds(elements: unknown[], userRequest: string): string[] {
  if (!Array.isArray(elements) || !hasConnectivityIntent(userRequest)) return [];

  const shapeIds = getShapeIds(elements);
  if (shapeIds.length < 2) return [];

  const adj = new Map<string, Set<string>>();
  for (const id of shapeIds) adj.set(id, new Set());

  for (const element of elements) {
    const el = element as ElementLike;
    if (el.type !== "arrow") continue;
    const start = el.startBinding?.elementId;
    const end = el.endBinding?.elementId;
    if (typeof start !== "string" || typeof end !== "string") continue;
    if (adj.has(start) && adj.has(end)) {
      adj.get(start)!.add(end);
      adj.get(end)!.add(start);
    }
  }

  const first = shapeIds[0]!;
  const seen = new Set<string>([first]);
  const queue = [first];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return shapeIds.filter((id) => !seen.has(id));
}

export function verifyCanvasElements({
  elements,
  userRequest,
}: {
  elements: unknown[];
  userRequest: string;
}): CanvasVerificationResult {
  const overlaps = findOverlaps(elements);
  const labelRisks = findLabelRenderRisks(elements);
  const unboundArrows = findUnboundArrows(elements);
  const arrowAnchorRisks = findArrowAnchorRisks(elements);
  const arrowLabelClearanceRisks = findArrowLabelClearanceRisks(elements);
  const arrowPathObstacleRisks = findArrowPathObstacleRisks(elements);
  const disconnectedShapeIds = findDisconnectedShapeIds(elements, userRequest);

  const issues: CanvasIssue[] = [
    ...overlaps.map(([a, b]) => ({
      kind: "overlap" as const,
      severity: "error" as const,
      elementIds: [a, b],
      message: `${a} overlaps ${b}.`,
      suggestion: "Move or resize one of these elements so their bounding boxes no longer collide.",
    })),
    ...labelRisks.map((risk) => ({
      kind: "risky_label" as const,
      severity: "warning" as const,
      elementIds: [risk.id],
      message: `${risk.id} may clip "${risk.text}".`,
      suggestion: `Widen the text bounds to at least ${Math.ceil(risk.requiredWidth)}px.`,
      details: {
        width: risk.width,
        requiredWidth: risk.requiredWidth,
        containerId: risk.containerId,
      },
    })),
    ...unboundArrows.map((risk) => ({
      kind: "unbound_arrow" as const,
      severity: "error" as const,
      elementIds: [risk.id],
      message: `${risk.id} is not bound to valid start and end shapes.`,
      suggestion: "Update or recreate the arrow with valid start and end bindings.",
      details: risk as unknown as Record<string, unknown>,
    })),
    ...arrowAnchorRisks.map((risk) => ({
      kind: "arrow_anchor" as const,
      severity: "warning" as const,
      elementIds: [risk.id, risk.startId, risk.endId],
      message: `${risk.id} is not anchored cleanly between aligned shapes.`,
      suggestion: `Straighten the arrow on the ${risk.axis} axis using the expected edge-center endpoints.`,
      details: risk as unknown as Record<string, unknown>,
    })),
    ...arrowLabelClearanceRisks.map((risk) => ({
      kind: "arrow_label_clearance" as const,
      severity: "warning" as const,
      elementIds: [risk.arrowId, risk.labelId, risk.startId, risk.endId],
      message: `${risk.labelId} does not have enough clearance on ${risk.arrowId}.`,
      suggestion: `Increase spacing between ${risk.startId} and ${risk.endId} to at least ${Math.ceil(risk.requiredGap)}px for the arrow label.`,
      details: {
        axis: risk.axis,
        gap: risk.gap,
        requiredGap: risk.requiredGap,
        missingGap: risk.missingGap,
      },
    })),
    ...arrowPathObstacleRisks.map((risk) => ({
      kind: "arrow_path_obstacle" as const,
      severity: "warning" as const,
      elementIds: [risk.arrowId, ...risk.blockedBy, risk.startId, risk.endId],
      message: `${risk.arrowId} crosses unrelated shape ${risk.blockedBy.join(", ")}.`,
      suggestion: "Route the arrow around blockers using intermediate points and roundness.",
      details: risk as unknown as Record<string, unknown>,
    })),
    ...disconnectedShapeIds.map((id) => ({
      kind: "disconnected_shape" as const,
      severity: "error" as const,
      elementIds: [id],
      message: `${id} is not reachable from the main connected component.`,
      suggestion: "Add or repair arrows so this shape is connected to the requested flow.",
    })),
  ];

  return {
    passed: issues.length === 0,
    connectivityRequired: hasConnectivityIntent(userRequest),
    summary: {
      overlaps: overlaps.length,
      riskyLabels: labelRisks.length,
      unboundArrows: unboundArrows.length,
      arrowAnchorRisks: arrowAnchorRisks.length,
      arrowLabelClearanceRisks: arrowLabelClearanceRisks.length,
      arrowPathObstacleRisks: arrowPathObstacleRisks.length,
      disconnectedShapes: disconnectedShapeIds.length,
    },
    issues,
  };
}
