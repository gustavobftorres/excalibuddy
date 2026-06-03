import { useState, useCallback, useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  newElementWith,
} from "@excalidraw/excalidraw";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import { serializeCanvasState } from "./context/canvas-state";
import { findOverlaps } from "./context/overlaps";
import { applyCrossCallBindings, mergeBoundElements } from "./context/cross-call-bindings";
import { cascadeRemoveElements } from "./context/remove-elements";
import { normalizeTextRenderBounds } from "./context/text-rendering";
import { normalizeArrowGeometry } from "./context/arrow-geometry";
import {
  finalizeTrace,
  getMessageMetadata,
  getTraceApiBaseUrl,
  hasPendingToolCall,
  sendFeedback,
} from "./flywheel/client";
import type { UserFeedback } from "./flywheel/types";
import "./App.css";

// One agent instance per page load. The canvas state lives only in the
// browser, so persisting chat history across refreshes would leave a dead
// conversation referencing diagrams that no longer exist.
const sessionId = crypto.randomUUID();
const agentHost = import.meta.env.VITE_AGENT_HOST;
const FINAL_TURN_SETTLE_MS = 900;

// Recursively drop null valued fields. Our tool schemas use nullable
// rather than optional so OpenAI strict mode stays on, which means the
// agent always sends every field. The Excalidraw skeleton helper expects
// undefined for "use the default," not null, and chokes on `label: null`
// or `start: null`. Recursion is required because nested objects (label,
// start, end) also carry nullable fields like fontSize and textAlign.
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

function normalizeCanvasElements<T extends readonly unknown[]>(elements: T): T {
  const updateElement = (element: unknown, updates: Record<string, unknown>) =>
    newElementWith(element as never, updates as never);
  return normalizeArrowGeometry(
    normalizeTextRenderBounds(elements, updateElement),
    updateElement
  );
}

function refreshCanvasRender(api: ExcalidrawImperativeAPI) {
  api.refresh();
  requestAnimationFrame(() => api.refresh());
  void document.fonts?.ready.then(() => api.refresh());
}

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [feedbackReadyMessageIds, setFeedbackReadyMessageIds] = useState<Set<string>>(new Set());
  const pendingTurnIdRef = useRef<string | undefined>(undefined);
  const finalizedAssistantIdsRef = useRef<Set<string>>(new Set());
  const traceApiBaseUrl = getTraceApiBaseUrl(agentHost);

  // Hold the latest excalidrawAPI in a ref so onToolCall (captured once at
  // hook init) always reads the live API instead of a stale closure copy.
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({
    agent: "design-agent",
    name: sessionId,
    ...(agentHost ? { host: agentHost } : {}),
  });

  // All four canvas tools are client side. The worker streams the call here,
  // we apply it to the live Excalidraw scene, and submit the result via
  // addToolOutput so the agent loop resumes.
  const { messages, sendMessage, status } = useAgentChat({
    agent,
    body: () => ({
      sessionId,
      turnId: pendingTurnIdRef.current,
    }),
    onToolCall: async ({ toolCall, addToolOutput }) => {
      const api = excalidrawAPIRef.current;
      if (!api) {
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { error: "canvas not ready" } });
        return;
      }

      if (toolCall.toolName === "queryCanvas") {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: { summary: serializeCanvasState(api.getSceneElements() as unknown[]) },
        });
        return;
      }

      if (toolCall.toolName === "addElements") {
        const { elements } = toolCall.input as { elements: unknown[] };
        // Strip null fields recursively before handing to
        // convertToExcalidrawElements. Our nullable schema forces the model
        // to send every field, but the skeleton helper expects undefined
        // (not null) for "use the default" and chokes on `label: null` or
        // `start: null`.
        const cleaned = elements.map(stripNulls) as Record<string, unknown>[];
        const newOnes = convertToExcalidrawElements(cleaned as never, { regenerateIds: false });

        // Patch arrow bindings that reference shapes already on the canvas
        // (the helper only resolves bindings within its own input batch).
        // See src/context/cross-call-bindings.ts for the gory details.
        const existingScene = api.getSceneElements();
        const { arrowsByTargetId } = applyCrossCallBindings(
          cleaned,
          newOnes as unknown as { id: string; startBinding?: unknown; endBinding?: unknown }[],
          existingScene as unknown as { id: string }[]
        );
        const patchedExisting = existingScene.map((el) => {
          const incoming = arrowsByTargetId.get(el.id);
          if (!incoming || incoming.length === 0) return el;
          const merged = mergeBoundElements(
            el as unknown as { id: string; boundElements?: readonly { id: string; type: string }[] },
            incoming
          );
          return newElementWith(el, { boundElements: merged } as never);
        });

        const next = normalizeCanvasElements([...patchedExisting, ...newOnes]);
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        refreshCanvasRender(api);
        api.scrollToContent(next, { fitToContent: true });
        // Detect overlaps in the post-add scene and surface them in the
        // tool result so the agent's next reasoning step sees collisions
        // and can self correct via updateElements. Same finding the
        // noOverlaps eval scorer would report.
        const overlaps = findOverlaps(next as unknown[]);
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: { added: newOnes.length, overlaps },
        });
        return;
      }

      if (toolCall.toolName === "updateElements") {
        const { updates } = toolCall.input as {
          updates: { id: string; fields: Record<string, unknown> }[];
        };
        const byId = new Map(
          updates.map((u) => [u.id, stripNulls(u.fields) as Record<string, unknown>])
        );
        const next = normalizeCanvasElements(api.getSceneElements().map((el) => {
          const fields = byId.get(el.id);
          return fields && Object.keys(fields).length > 0
            ? newElementWith(el, fields as never)
            : el;
        }));
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        refreshCanvasRender(api);
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { updated: byId.size } });
        return;
      }

      if (toolCall.toolName === "removeElements") {
        const { ids } = toolCall.input as { ids: string[] };
        const next = cascadeRemoveElements(api.getSceneElements(), ids);
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        refreshCanvasRender(api);
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { removed: ids.length } });
        return;
      }
    },
  });

  const sendMessageWithTrace = useCallback(
    (message: { role: "user"; parts: { type: "text"; text: string }[] }) => {
      const turnId = crypto.randomUUID();
      pendingTurnIdRef.current = turnId;
      sendMessage({
        ...message,
        metadata: { turnId, sessionId },
      } as UIMessage);
    },
    [sendMessage]
  );

  const handleFeedback = useCallback(
    async (feedback: UserFeedback) => {
      await sendFeedback(traceApiBaseUrl, feedback);
    },
    [traceApiBaseUrl]
  );

  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    const api = excalidrawAPIRef.current;
    if (!api) return;

    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!latestAssistant || hasPendingToolCall(latestAssistant)) return;
    if (finalizedAssistantIdsRef.current.has(latestAssistant.id)) return;

    const metadata = getMessageMetadata(latestAssistant);
    if (!metadata.turnId) return;

    const timeout = window.setTimeout(() => {
      const currentLatestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
      if (!currentLatestAssistant || currentLatestAssistant.id !== latestAssistant.id) return;
      if (hasPendingToolCall(currentLatestAssistant)) return;
      finalizedAssistantIdsRef.current.add(latestAssistant.id);
      const finalCanvasSummary = serializeCanvasState(api.getSceneElements() as unknown[]);
      setFeedbackReadyMessageIds((prev) => {
        const next = new Set(prev);
        for (const message of messages) {
          const messageMetadata = getMessageMetadata(message);
          if (messageMetadata.turnId === metadata.turnId) next.delete(message.id);
        }
        next.add(latestAssistant.id);
        return next;
      });
      void finalizeTrace({
        apiBaseUrl: traceApiBaseUrl,
        turnId: metadata.turnId as string,
        sessionId: metadata.sessionId ?? sessionId,
        assistantMessage: latestAssistant,
        finalCanvasSummary,
      });
    }, FINAL_TURN_SETTLE_MS);

    return () => window.clearTimeout(timeout);
  }, [messages, status, traceApiBaseUrl]);

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel
        messages={messages}
        sendMessage={sendMessageWithTrace}
        onFeedback={handleFeedback}
        feedbackReadyMessageIds={feedbackReadyMessageIds}
        status={status}
      />
      <a href="#viewer" className="viewer-launch" title="Open diagram viewer for human scoring">
        viewer
      </a>
    </div>
  );
}
