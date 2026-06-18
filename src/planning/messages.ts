import type { UIMessage } from "ai";
import { isPlanApprovalPayload } from "./approval";
import type { PlanApprovalPayload } from "./types";

export interface PlanApprovalMessage {
  toolCallId: string;
  plan: PlanApprovalPayload;
}

export function getLatestPlanApprovalMessage(messages: UIMessage[]): PlanApprovalMessage | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message?.role !== "assistant") continue;

    for (let partIndex = (message.parts ?? []).length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts?.[partIndex] as
        | {
            type?: string;
            toolCallId?: string;
            input?: unknown;
            state?: string;
          }
        | undefined;
      if (
        part?.type !== "tool-requestPlanApproval" ||
        part.state !== "output-available" ||
        !part.input ||
        !part.toolCallId ||
        !isPlanApprovalPayload(part.input)
      ) {
        continue;
      }
      return {
        toolCallId: part.toolCallId,
        plan: part.input,
      };
    }
  }

  return null;
}
