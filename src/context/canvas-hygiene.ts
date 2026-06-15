import { findArrowPathObstacleRisks } from "./arrow-geometry";
import { findOverlaps } from "./overlaps";

export function summarizeCanvasHygiene(elements: unknown[]) {
  return {
    overlaps: findOverlaps(elements),
    arrowPathObstacles: findArrowPathObstacleRisks(elements),
  };
}
