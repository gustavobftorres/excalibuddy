import type { UIMessage } from "ai";

export function buildUIMessageStreamResponseOptions(
  messages: UIMessage[],
  turnId: string,
  sessionId: string,
  assistantMessageId?: string
) {
  return {
    originalMessages: messages,
    ...(assistantMessageId ? { generateMessageId: () => assistantMessageId } : {}),
    messageMetadata: ({ part }: { part: { type: string } }) => {
      if (part.type === "start" || part.type === "finish") {
        return { turnId, sessionId };
      }
      return undefined;
    },
  };
}
