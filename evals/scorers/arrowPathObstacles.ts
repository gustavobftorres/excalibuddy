// Measures whether arrow paths visually cross unrelated shapes. Regular
// overlap checks intentionally exclude arrows, so this scorer covers the
// path-specific rendering failure without penalizing valid endpoint contact.

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";
import { findArrowPathObstacleRisks } from "../../src/context/arrow-geometry";

export const arrowPathObstaclesScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
}) => {
  const elements = (output.elements ?? []) as Record<string, unknown>[];
  const arrows = elements.filter((element) => element?.type === "arrow");
  if (arrows.length === 0) return null;

  const risks = findArrowPathObstacleRisks(elements);
  const score = Math.max(0, 1 - risks.length / arrows.length);

  return {
    name: "ArrowPathObstacles",
    score,
    metadata: {
      passed: risks.length === 0,
      risky: risks,
      totalArrows: arrows.length,
    },
  };
};
