import type { Category, Difficulty, GoldenTestCase } from "../../evals/buildMessages";

export interface TraceToolCall {
  name: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
}

export interface TraceMetrics {
  start: number;
  end: number;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProductionTrace {
  id: string;
  sessionId: string;
  assistantMessageId?: string;
  userInput: string;
  modelMessages: unknown[];
  finalText: string;
  finalCanvasSummary?: unknown;
  toolCalls: TraceToolCall[];
  metrics: TraceMetrics;
  metadata: {
    model: string;
    environment: "development" | "production";
    appVersion?: string;
    finalized?: boolean;
  };
}

export interface UserFeedback {
  turnId: string;
  rating: 1 | 0;
  comment?: string;
  assistantMessageId: string;
  sessionId: string;
}

export interface FlywheelCandidate {
  sourceTraceId: string;
  userInput: string;
  finalText: string;
  toolCalls: TraceToolCall[];
  feedback: "thumbs_down" | "thumbs_up" | "none";
  comment?: string;
  reasons: string[];
  suggested: {
    id: string;
    expectedCharacteristics: string[];
    expectedKeywords?: string[];
    difficulty: Difficulty;
    category: Category;
    reviewNotes: string;
  };
}

export type FlywheelRegressionCase = GoldenTestCase & {
  sourceTraceId: string;
  feedback: "thumbs_down" | "thumbs_up";
  reviewNotes: string;
};

export interface ChatMessageMetadata {
  turnId?: string;
  sessionId?: string;
}
