// LabelRenderBounds scorer
// ========================
//
// Measures whether text elements have enough horizontal bounds to render
// without likely clipping. This is paired with the same helper used by the
// live canvas normalization and by queryCanvas warnings.

import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";
import { findLabelRenderRisks } from "../../src/context/text-rendering";

export const labelRenderBoundsScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
}) => {
  const elements = (output.elements ?? []) as Record<string, unknown>[];
  const textElements = elements.filter((element) => element?.type === "text");
  if (textElements.length === 0) return null;

  const risks = findLabelRenderRisks(elements);
  const score = Math.max(0, 1 - risks.length / textElements.length);

  return {
    name: "LabelRenderBounds",
    score,
    metadata: {
      passed: risks.length === 0,
      risky: risks.map((risk) => ({
        id: risk.id,
        text: risk.text,
        width: Math.round(risk.width),
        requiredWidth: Math.round(risk.requiredWidth),
        containerId: risk.containerId,
      })),
      totalTextElements: textElements.length,
    },
  };
};
