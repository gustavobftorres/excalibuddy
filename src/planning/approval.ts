import { buildApprovedPlanPrompt } from "./session";
import type { PlanApprovalPayload } from "./types";

export type ApprovePlanCommand = {
  type: "agent.command";
  command: "implement_plan";
  payload: {
    planId: string;
    source: "approve_plan_button";
    prompt: string;
  };
};

export type ApprovePlanCommandResult =
  | { ok: true; command: ApprovePlanCommand }
  | { ok: false; reason: string };

export function isPlanApprovalPayload(value: unknown): value is PlanApprovalPayload {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<PlanApprovalPayload>;
  return (
    typeof plan.title === "string" &&
    typeof plan.summary === "string" &&
    Array.isArray(plan.steps) &&
    plan.steps.every((step) => typeof step === "string") &&
    Array.isArray(plan.assumptions) &&
    plan.assumptions.every((assumption) => typeof assumption === "string") &&
    Array.isArray(plan.questions) &&
    plan.questions.every((question) => typeof question === "string")
  );
}

export function buildApprovePlanCommand(input: {
  plan: PlanApprovalPayload | unknown | null;
  planId: string | null;
  originalPrompt: string | null;
}): ApprovePlanCommandResult {
  if (!input.plan) {
    return { ok: false, reason: "No active plan to approve." };
  }

  if (!isPlanApprovalPayload(input.plan)) {
    return { ok: false, reason: "Cannot approve this plan because it is incomplete." };
  }

  if (!input.planId) {
    return { ok: false, reason: "Cannot approve this plan because its id is missing." };
  }

  if (!input.originalPrompt?.trim()) {
    return {
      ok: false,
      reason: "Cannot start implementation because the original request is missing.",
    };
  }

  return {
    ok: true,
    command: {
      type: "agent.command",
      command: "implement_plan",
      payload: {
        planId: input.planId,
        source: "approve_plan_button",
        prompt: buildApprovedPlanPrompt({
          originalPrompt: input.originalPrompt,
          plan: input.plan,
        }),
      },
    },
  };
}
