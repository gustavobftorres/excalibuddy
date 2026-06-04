import type { PlanApprovalPayload, PlanningGateInput } from "./types";

export function shouldStartInPlanningMode(input: PlanningGateInput) {
  return (
    input.planningModeEnabled &&
    input.sceneElementCount === 0 &&
    !input.pendingPlanApproval
  );
}

export function buildApprovedPlanPrompt(input: {
  originalPrompt: string;
  plan: PlanApprovalPayload;
}) {
  const steps = input.plan.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const assumptions =
    input.plan.assumptions.length > 0
      ? input.plan.assumptions.map((item) => `- ${item}`).join("\n")
      : "- None";
  const questions =
    input.plan.questions.length > 0
      ? input.plan.questions.map((item) => `- ${item}`).join("\n")
      : "- None";

  return [
    "The user approved the plan below. Build the diagram now.",
    `Original request: ${input.originalPrompt}`,
    `Plan title: ${input.plan.title}`,
    `Plan summary: ${input.plan.summary}`,
    "Approved plan:",
    steps,
    "Assumptions:",
    assumptions,
    "Open questions resolved or accepted:",
    questions,
  ].join("\n");
}
