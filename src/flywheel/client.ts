import type { ChatMessageMetadata, TraceToolCall, UserFeedback } from "./types";
import type { UIMessage } from "ai";

export function getTraceApiBaseUrl(agentHost?: string): string {
  if (!agentHost) return "";
  if (agentHost.startsWith("http://") || agentHost.startsWith("https://")) {
    return agentHost.replace(/\/$/, "");
  }
  return `https://${agentHost.replace(/\/$/, "")}`;
}

async function postJson(path: string, body: unknown, apiBaseUrl: string): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn(`Flywheel request failed: ${path}`, error);
  }
}

export function getMessageMetadata(message: UIMessage): ChatMessageMetadata {
  return (message.metadata ?? {}) as ChatMessageMetadata;
}

export function getMessageText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function getMessageToolCalls(message: UIMessage): TraceToolCall[] {
  return (message.parts ?? [])
    .filter((part) => part.type?.startsWith("tool-"))
    .map((part) => {
      const toolPart = part as {
        type: string;
        input?: unknown;
        output?: unknown;
        state?: string;
      };
      return {
        name: toolPart.type.replace("tool-", ""),
        input: toolPart.input,
        output: toolPart.output,
      };
    });
}

export function hasPendingToolCall(message: UIMessage): boolean {
  return (message.parts ?? []).some((part) => {
    if (!part.type?.startsWith("tool-")) return false;
    const toolPart = part as { state?: string };
    return toolPart.state !== "output-available" && toolPart.state !== "output-error";
  });
}

export function finalizeTrace({
  apiBaseUrl,
  turnId,
  sessionId,
  assistantMessage,
  finalCanvasSummary,
}: {
  apiBaseUrl: string;
  turnId: string;
  sessionId?: string;
  assistantMessage: UIMessage;
  finalCanvasSummary?: unknown;
}): Promise<void> {
  return postJson(
    "/api/traces/finalize",
    {
      turnId,
      sessionId,
      assistantMessageId: assistantMessage.id,
      finalText: getMessageText(assistantMessage),
      finalCanvasSummary,
      toolCalls: getMessageToolCalls(assistantMessage),
    },
    apiBaseUrl
  );
}

export function sendFeedback(apiBaseUrl: string, feedback: UserFeedback): Promise<void> {
  return postJson("/api/feedback", feedback, apiBaseUrl);
}
