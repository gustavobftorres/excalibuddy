import type { UIMessage } from "ai";
import { getMessageMetadata } from "./flywheel/client";

export type AgentFailureKind = "timeout" | "network" | "agent";

export interface AgentFailureNotice {
  id: string;
  kind: AgentFailureKind;
  title: string;
  description: string;
}

export interface AgentFailureLog {
  turnId?: string;
  sessionId?: string;
  assistantMessageId?: string;
  kind: AgentFailureKind;
  source: "client" | "tool" | "server";
  message: string;
  toolName?: string;
}

export interface SerializableAgentError {
  name?: string;
  message: string;
  cause?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

export function serializeAgentError(error: unknown): SerializableAgentError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: getErrorMessage(error.cause),
    };
  }
  if (error && typeof error === "object") {
    return {
      name: "UnknownObject",
      message: getErrorMessage(error) || JSON.stringify(error),
    };
  }
  return { message: getErrorMessage(error) || String(error) };
}

export function classifyAgentFailure(error: unknown, online = true): AgentFailureKind {
  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("deadline") ||
    message.includes("504") ||
    message.includes("abort")
  ) {
    return "timeout";
  }
  if (
    !online ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("offline") ||
    message.includes("cors")
  ) {
    return "network";
  }
  return "agent";
}

export function buildFailureNotice({
  id,
  kind,
  toolName,
}: {
  id: string;
  kind: AgentFailureKind;
  toolName?: string;
}): AgentFailureNotice {
  if (kind === "timeout") {
    return {
      id,
      kind,
      title: "The agent timed out",
      description: "This took longer than expected. You can retry the last prompt when ready.",
    };
  }
  if (kind === "network") {
    return {
      id,
      kind,
      title: "Connection interrupted",
      description: "Check your connection, then retry the last prompt. Your canvas is still here.",
    };
  }
  return {
    id,
    kind,
    title: toolName ? `${toolName} failed` : "The agent hit a snag",
    description: "Something failed while generating the diagram. Retry, or tweak the prompt and send again.",
  };
}

export function getLatestToolFailure(messages: UIMessage[]): AgentFailureLog | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    for (const part of [...(message.parts ?? [])].reverse()) {
      if (!part.type?.startsWith("tool-")) continue;
      const toolPart = part as { state?: string; errorText?: string; type: string };
      if (toolPart.state !== "output-error") continue;
      const metadata = getMessageMetadata(message);
      const toolName = toolPart.type.replace("tool-", "");
      return {
        turnId: metadata.turnId,
        sessionId: metadata.sessionId,
        assistantMessageId: message.id,
        kind: "agent",
        source: "tool",
        message: toolPart.errorText || `${toolName} returned an error`,
        toolName,
      };
    }
  }
  return null;
}

export async function logAgentFailure(apiBaseUrl: string, failure: AgentFailureLog): Promise<void> {
  console.warn("Agent failure", JSON.stringify(failure));
  if (!apiBaseUrl) return;
  try {
    await fetch(`${apiBaseUrl}/api/traces/failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(failure),
    });
  } catch (error) {
    console.warn("Agent failure log failed", error);
  }
}

export function getFailureMessage(error: unknown): string {
  return getErrorMessage(error) || "Unknown agent failure";
}
