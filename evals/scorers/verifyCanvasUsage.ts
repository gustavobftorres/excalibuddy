import type { EvalScorer } from "braintrust";
import type { GoldenTestCase } from "../buildMessages";
import type { AgentOutput } from "./schema";
import { hasConnectivityIntent } from "../../src/context/verify-canvas";

export const verifyCanvasUsageScorer: EvalScorer<GoldenTestCase, AgentOutput, GoldenTestCase> = ({
  output,
  expected,
}) => {
  if (!expected || !hasConnectivityIntent(expected.input)) return null;

  const calls = output.toolCalls ?? [];
  const firstMutation = calls.findIndex(
    (name) => name === "addElements" || name === "updateElements" || name === "removeElements"
  );
  if (firstMutation < 0) return null;

  const verifyAfterMutation = calls
    .slice(firstMutation + 1)
    .some((name) => name === "verifyCanvas");

  return {
    name: "VerifyCanvasUsage",
    score: verifyAfterMutation ? 1 : 0,
    metadata: {
      id: expected.id,
      category: expected.category,
      input: expected.input,
      calls,
      reason: verifyAfterMutation
        ? "verifyCanvas called after mutation"
        : "verifyCanvas not called after mutation",
    },
  };
};
