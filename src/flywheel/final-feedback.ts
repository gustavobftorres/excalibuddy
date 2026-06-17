import type { UIMessage } from "ai";
import { getMessageMetadata, hasPendingToolCall } from "./client";
import type { ChatMessageMetadata } from "./types";

export interface FinalFeedbackCandidate {
  message: UIMessage;
  metadata: ChatMessageMetadata & { turnId: string };
}

export function isFinalFeedbackCandidate(message: UIMessage): boolean {
  if (message.role !== "assistant") return false;
  const metadata = getMessageMetadata(message);
  if (!metadata.turnId) return false;
  if (hasPendingToolCall(message)) return false;
  return true;
}

export function getFinalFeedbackCandidate(messages: UIMessage[]): FinalFeedbackCandidate | undefined {
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!latestAssistant || !isFinalFeedbackCandidate(latestAssistant)) return undefined;

  const metadata = getMessageMetadata(latestAssistant);
  return {
    message: latestAssistant,
    metadata: metadata as ChatMessageMetadata & { turnId: string },
  };
}
