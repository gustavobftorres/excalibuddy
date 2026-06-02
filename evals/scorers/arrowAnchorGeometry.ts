// ArrowAnchorGeometry scorer
// ==========================
//
// Measures whether arrows between horizontally/vertically aligned shapes are
// rendered as straight connectors between the expected edge centers.

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";
import { findArrowAnchorRisks } from "../../src/context/arrow-geometry";

export const arrowAnchorGeometryScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
}) => {
  const elements = (output.elements ?? []) as Record<string, unknown>[];
  const arrows = elements.filter((element) => element?.type === "arrow");
  if (arrows.length === 0) return null;

  const risks = findArrowAnchorRisks(elements);
  const score = Math.max(0, 1 - risks.length / arrows.length);

  return {
    name: "ArrowAnchorGeometry",
    score,
    metadata: {
      passed: risks.length === 0,
      risky: risks.map((risk) => ({
        id: risk.id,
        reason: risk.reason,
        startId: risk.startId,
        endId: risk.endId,
        axis: risk.axis,
        expectedStart: risk.expectedStart,
        expectedEnd: risk.expectedEnd,
        actualStart: risk.actualStart,
        actualEnd: risk.actualEnd,
      })),
      totalArrows: arrows.length,
    },
  };
};
