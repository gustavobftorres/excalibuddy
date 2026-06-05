import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  type StreamTextOnErrorCallback,
  type StreamTextOnFinishCallback,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { streamAgent, streamPlanningAgent } from "./agent-core";
import { buildUIMessageStreamResponseOptions } from "./agent-stream-options";
import { insertProjectLog, shouldLogTraces } from "./observability/braintrust";
import { classifyAgentFailure } from "./agent-failures";
import type { ChatMessageMetadata, TraceToolCall } from "./flywheel/types";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
  TAVILY_API_KEY: string;
  UPSTASH_VECTOR_REST_URL: string;
  UPSTASH_VECTOR_REST_TOKEN: string;
  BRAINTRUST_API_KEY?: string;
  BRAINTRUST_PROJECT_ID?: string;
  TRACE_LOGGING_ENABLED?: string;
}

function getText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function getLatestUserMessage(messages: UIMessage[]): UIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i];
  }
  return undefined;
}

function getTraceMetadata(message: UIMessage | undefined): ChatMessageMetadata {
  return (message?.metadata ?? {}) as ChatMessageMetadata;
}

function collectToolCalls(steps: { toolCalls?: unknown[]; toolResults?: unknown[] }[]): TraceToolCall[] {
  return steps.flatMap((step) => {
    const results = new Map<string, unknown>();
    for (const result of step.toolResults ?? []) {
      if (result && typeof result === "object" && "toolCallId" in result) {
        results.set(String((result as { toolCallId: unknown }).toolCallId), result);
      }
    }

    return (step.toolCalls ?? []).map((call) => {
      const record = call as {
        toolCallId?: string;
        toolName?: string;
        input?: unknown;
      };
      return {
        name: record.toolName ?? "unknown",
        input: record.input,
        output: record.toolCallId ? results.get(record.toolCallId) : undefined,
      };
    });
  });
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage(onFinish?: StreamTextOnFinishCallback<any>, options?: { requestId: string; body?: Record<string, unknown> }) {
    const openai = createOpenAI({ apiKey: this.env.OPENAI_API_KEY });
    const modelId = "gpt-5.4";
    const model = openai(modelId);
    const messages = await convertToModelMessages(this.messages);
    const latestUser = getLatestUserMessage(this.messages);
    const latestUserMetadata = getTraceMetadata(latestUser);
    const turnId =
      typeof options?.body?.turnId === "string"
        ? options.body.turnId
        : latestUserMetadata.turnId ?? options?.requestId ?? crypto.randomUUID();
    const mode = options?.body?.mode === "planning" ? "planning" : "build";
    const sessionId =
      typeof options?.body?.sessionId === "string"
        ? options.body.sessionId
        : latestUserMetadata.sessionId ?? "unknown";
    const assistantMessageId =
      typeof options?.body?.assistantMessageId === "string"
        ? options.body.assistantMessageId
        : undefined;
    const start = Date.now();

    const logOnFinish: StreamTextOnFinishCallback<any> = async (event) => {
      const end = Date.now();
      if (
        shouldLogTraces({
          apiKey: this.env.BRAINTRUST_API_KEY,
          projectId: this.env.BRAINTRUST_PROJECT_ID,
          enabled: this.env.TRACE_LOGGING_ENABLED,
        })
      ) {
        await insertProjectLog({
          apiKey: this.env.BRAINTRUST_API_KEY as string,
          projectId: this.env.BRAINTRUST_PROJECT_ID as string,
          event: {
            id: turnId,
            input: {
              userInput: latestUser ? getText(latestUser) : "",
              modelMessages: messages,
            },
            output: {
              finalText: event.text,
              toolCalls: collectToolCalls(event.steps),
            },
            tags: ["production", "assistant-turn", "diagram-agent"],
            metadata: {
              sessionId,
              model: modelId,
              environment: "production",
            },
            metrics: {
              start,
              end,
              latencyMs: end - start,
              prompt_tokens: event.totalUsage.inputTokens,
              completion_tokens: event.totalUsage.outputTokens,
              tokens: event.totalUsage.totalTokens,
            },
          },
        });
      }
      await onFinish?.(event);
    };

    const logOnError: StreamTextOnErrorCallback = async ({ error }) => {
      const end = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      if (
        shouldLogTraces({
          apiKey: this.env.BRAINTRUST_API_KEY,
          projectId: this.env.BRAINTRUST_PROJECT_ID,
          enabled: this.env.TRACE_LOGGING_ENABLED,
        })
      ) {
        await insertProjectLog({
          apiKey: this.env.BRAINTRUST_API_KEY as string,
          projectId: this.env.BRAINTRUST_PROJECT_ID as string,
          event: {
            id: turnId,
            input: {
              userInput: latestUser ? getText(latestUser) : "",
              modelMessages: messages,
            },
            output: { error: message },
            tags: ["production", "assistant-turn", "diagram-agent", "failure"],
            metadata: {
              sessionId,
              model: modelId,
              environment: "production",
              kind: classifyAgentFailure(error),
              source: "server",
            },
            metrics: {
              start,
              end,
              latencyMs: end - start,
            },
          },
        });
      }
    };

    const agentArgs = {
      model,
      messages,
      onFinish: logOnFinish,
      onError: logOnError,
      env: {
        TAVILY_API_KEY: this.env.TAVILY_API_KEY,
        UPSTASH_VECTOR_REST_URL: this.env.UPSTASH_VECTOR_REST_URL,
        UPSTASH_VECTOR_REST_TOKEN: this.env.UPSTASH_VECTOR_REST_TOKEN,
      },
    };

    const result = mode === "planning" ? streamPlanningAgent(agentArgs) : streamAgent(agentArgs);

    return result.toUIMessageStreamResponse(
      buildUIMessageStreamResponseOptions(this.messages, turnId, sessionId, assistantMessageId)
    );
  }
}
