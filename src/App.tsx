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
import FailureToaster from "./components/notifications/FailureToaster";
import { getRetryMessage } from "./components/chat/retry";
import TrialEndModal from "./components/trial/TrialEndModal";
import {
  buildFailureNotice,
  classifyAgentFailure,
  getFailureMessage,
  getLatestToolFailure,
  logAgentFailure,
  type AgentFailureNotice,
} from "./agent-failures";
import { getLatestPlanApprovalMessage } from "./planning/messages";
import {
  buildAgentRequestBody,
  buildApprovedPlanPrompt,
  shouldStartInPlanningMode,
  type AgentMode,
} from "./planning/session";
import type { PlanApprovalPayload } from "./planning/types";
import { serializeCanvasState } from "./context/canvas-state";
import { findOverlaps } from "./context/overlaps";
import { applyCrossCallBindings, mergeBoundElements } from "./context/cross-call-bindings";
import { cascadeRemoveElements } from "./context/remove-elements";
import { normalizeTextRenderBounds } from "./context/text-rendering";
import { normalizeArrowGeometry } from "./context/arrow-geometry";
import {
  getTrialStateFromStorage,
  recordTrialPrompt,
  shouldBlockAgentPrompts,
  TRIAL_STORAGE_KEY,
  type TrialState,
} from "./trial-state";
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
const REPOSITORY_URL = "https://github.com/gustavobftorres/excalibuddy";
const TRIAL_MODAL_DISMISSED_KEY = "excalibuddy-trial-modal-dismissed";
const ONBOARDING_DISMISSED_KEY = "excalibuddy-onboarding-dismissed";
const PLANNING_MODE_ENABLED_KEY = "excalibuddy-planning-mode-enabled";
const TEST_PROMPT =
  "Create a simple flowchart for a bug fix workflow: Bug report -> Reproduce -> Fix -> Review -> Deploy.";
const SUGGESTED_PROMPTS = [
  "Map a startup org chart with CEO, Product, Engineering, Design, and Sales.",
  "Create a system design diagram for a web app with frontend, API, database, and cache.",
];

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [planningModeEnabled, setPlanningModeEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(PLANNING_MODE_ENABLED_KEY);
    return stored === null ? true : stored === "true";
  });
  const [agentMode, setAgentMode] = useState<"planning" | "build">("build");
  const [planningModeNotice, setPlanningModeNotice] = useState<string | null>(null);
  const [pendingPlanApproval, setPendingPlanApproval] = useState<PlanApprovalPayload | null>(null);
  const [pendingPlanApprovalId, setPendingPlanApprovalId] = useState<string | null>(null);
  const [lastCreatePrompt, setLastCreatePrompt] = useState<string | null>(null);
  const [trialState, setTrialState] = useState<TrialState>(() => {
    if (typeof window === "undefined") return getTrialStateFromStorage(null);
    return getTrialStateFromStorage(window.localStorage.getItem(TRIAL_STORAGE_KEY));
  });
  const [trialModalDismissed, setTrialModalDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(TRIAL_MODAL_DISMISSED_KEY) === "true";
  });
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
  });
  const [feedbackReadyMessageIds, setFeedbackReadyMessageIds] = useState<Set<string>>(new Set());
  const [failureNotices, setFailureNotices] = useState<AgentFailureNotice[]>([]);
  const pendingTurnIdRef = useRef<string | undefined>(undefined);
  const pendingAssistantMessageIdRef = useRef<string | undefined>(undefined);
  const pendingAgentModeRef = useRef<AgentMode | undefined>(undefined);
  const finalizedAssistantIdsRef = useRef<Set<string>>(new Set());
  const resolvedPlanToolCallIdsRef = useRef<Set<string>>(new Set());
  const loggedFailureIdsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    window.localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(trialState));
  }, [trialState]);

  useEffect(() => {
    window.localStorage.setItem(TRIAL_MODAL_DISMISSED_KEY, String(trialModalDismissed));
  }, [trialModalDismissed]);

  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, String(onboardingDismissed));
  }, [onboardingDismissed]);

  useEffect(() => {
    window.localStorage.setItem(PLANNING_MODE_ENABLED_KEY, String(planningModeEnabled));
  }, [planningModeEnabled]);

  const agent = useAgent({
    agent: "design-agent",
    name: sessionId,
    ...(agentHost ? { host: agentHost } : {}),
  });

  const showFailureNotice = useCallback((notice: AgentFailureNotice) => {
    setFailureNotices((current) => {
      const withoutSameNotice = current.filter((item) => item.id !== notice.id);
      return [...withoutSameNotice, notice].slice(-3);
    });
  }, []);

  // All four canvas tools are client side. The worker streams the call here,
  // we apply it to the live Excalidraw scene, and submit the result via
  // addToolOutput so the agent loop resumes.
  const { messages, sendMessage, status } = useAgentChat({
    agent,
    generateId: () => pendingAssistantMessageIdRef.current ?? crypto.randomUUID(),
    body: () =>
      buildAgentRequestBody({
        sessionId,
        turnId: pendingTurnIdRef.current,
        assistantMessageId: pendingAssistantMessageIdRef.current,
        requestedMode: pendingAgentModeRef.current,
        planningModeEnabled,
        currentAgentMode: agentMode,
      }),
    onToolCall: async ({ toolCall, addToolOutput }) => {
      const api = excalidrawAPIRef.current;
      if (
        planningModeEnabled &&
        (toolCall.toolName === "queryCanvas" ||
          toolCall.toolName === "addElements" ||
          toolCall.toolName === "updateElements" ||
          toolCall.toolName === "removeElements")
      ) {
        setPlanningModeNotice(
          "Planning mode is still on. Turn it off to let the agent modify the canvas."
        );
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: {
            error: "planning mode enabled; disable it before executing the plan",
          },
        });
        return;
      }

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
    onError: (error) => {
      const kind = classifyAgentFailure(error, navigator.onLine);
      const turnId = pendingTurnIdRef.current;
      const assistantMessageId = pendingAssistantMessageIdRef.current;
      const failureId = `client-${turnId ?? crypto.randomUUID()}`;
      showFailureNotice(buildFailureNotice({ id: failureId, kind }));
      void logAgentFailure(traceApiBaseUrl, {
        turnId,
        sessionId,
        assistantMessageId,
        kind,
        source: "client",
        message: getFailureMessage(error),
      });
    },
  });

  useEffect(() => {
    const latestPlanApproval = getLatestPlanApprovalMessage(messages);
    if (!latestPlanApproval) return;
    if (resolvedPlanToolCallIdsRef.current.has(latestPlanApproval.toolCallId)) return;
    if (pendingPlanApprovalId === latestPlanApproval.toolCallId) return;

    setPendingPlanApproval(latestPlanApproval.plan);
    setPendingPlanApprovalId(latestPlanApproval.toolCallId);
    setAgentMode("planning");
    setPlanningModeNotice(null);
  }, [messages, pendingPlanApprovalId]);

  const sendMessageWithTrace = useCallback(
    (
      message: { role: "user"; parts: { type: "text"; text: string }[] },
      overrideMode?: "planning" | "build"
    ) => {
      if (shouldBlockAgentPrompts(trialState)) {
        setTrialModalDismissed(false);
        return;
      }

      const nextTrialState = recordTrialPrompt(trialState);
      setTrialState(nextTrialState);
      if (nextTrialState.trialEnded) {
        setTrialModalDismissed(false);
      }

      const sceneElementCount = excalidrawAPIRef.current?.getSceneElements().length ?? 0;
      const continuePlanning =
        planningModeEnabled ||
        (agentMode === "planning" && sceneElementCount === 0 && pendingPlanApproval === null);
      const nextMode =
        overrideMode ??
        (continuePlanning
          ? "planning"
          : shouldStartInPlanningMode({
              sceneElementCount,
              planningModeEnabled,
              hasPriorAssistantMessages: messages.some((entry) => entry.role === "assistant"),
              pendingPlanApproval: pendingPlanApproval !== null,
            })
            ? "planning"
            : "build");

      setPlanningModeNotice(null);

      if (nextMode === "planning" && lastCreatePrompt === null) {
        setLastCreatePrompt(message.parts[0]?.text ?? "");
      }

      if (overrideMode === "planning" || nextMode === "planning") {
        setPendingPlanApproval(null);
      }
      setAgentMode(nextMode);

      const turnId = crypto.randomUUID();
      const userMessageId = `user-${turnId}`;
      const assistantMessageId = `assistant-${turnId}`;
      setFailureNotices([]);
      pendingTurnIdRef.current = turnId;
      pendingAssistantMessageIdRef.current = assistantMessageId;
      pendingAgentModeRef.current = nextMode;
      sendMessage({
        ...message,
        id: userMessageId,
        metadata: { turnId, sessionId },
      } as UIMessage);
    },
    [
      agentMode,
      lastCreatePrompt,
      messages,
      pendingPlanApproval,
      planningModeEnabled,
      sendMessage,
      trialState,
    ]
  );

  const handleClearCanvas = useCallback(() => {
    const api = excalidrawAPIRef.current;
    if (!api) return;
    api.updateScene({ elements: [], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    refreshCanvasRender(api);
  }, []);

  const retryMessage = getRetryMessage(messages);
  const isStreaming = status === "submitted" || status === "streaming";

  const handleRetry = useCallback(() => {
    if (!retryMessage) return;
    setFailureNotices([]);
    sendMessageWithTrace(retryMessage);
  }, [retryMessage, sendMessageWithTrace]);

  const handleDismissFailureNotice = useCallback((id: string) => {
    setFailureNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  useEffect(() => {
    const failure = getLatestToolFailure(messages);
    if (!failure) return;
    const failureId = `tool-${failure.assistantMessageId ?? "unknown"}-${failure.toolName ?? "unknown"}`;
    if (loggedFailureIdsRef.current.has(failureId)) return;
    loggedFailureIdsRef.current.add(failureId);
    showFailureNotice(
      buildFailureNotice({
        id: failureId,
        kind: failure.kind,
        toolName: failure.toolName,
      })
    );
    void logAgentFailure(traceApiBaseUrl, failure);
  }, [messages, showFailureNotice, traceApiBaseUrl]);

  const handleApprovePlan = useCallback(() => {
    if (!pendingPlanApproval || !lastCreatePrompt) return;

    if (planningModeEnabled) {
      setPlanningModeNotice(
        "Turn off Planning mode to execute this approved plan on the canvas."
      );
      return;
    }

    const approvedPlanPrompt = buildApprovedPlanPrompt({
      originalPrompt: lastCreatePrompt,
      plan: pendingPlanApproval,
    });

    setPendingPlanApproval(null);
    if (pendingPlanApprovalId) {
      resolvedPlanToolCallIdsRef.current.add(pendingPlanApprovalId);
      setPendingPlanApprovalId(null);
    }
    setAgentMode("build");
    setPlanningModeNotice(null);
    void sendMessageWithTrace(
      {
        role: "user",
        parts: [{ type: "text", text: approvedPlanPrompt }],
      },
      "build"
    );
  }, [lastCreatePrompt, pendingPlanApproval, pendingPlanApprovalId, sendMessageWithTrace]);

  const handleRequestPlanChanges = useCallback(() => {
    setPendingPlanApproval(null);
    if (pendingPlanApprovalId) {
      resolvedPlanToolCallIdsRef.current.add(pendingPlanApprovalId);
      setPendingPlanApprovalId(null);
    }
    setAgentMode("planning");
    setPlanningModeNotice(null);
    setDraftPrompt("Please revise the plan: ");
  }, [pendingPlanApprovalId]);

  const handlePlanningModeToggle = useCallback((enabled: boolean) => {
    setPlanningModeEnabled(enabled);
    if (!enabled) {
      setPlanningModeNotice(null);
      setAgentMode("build");
      return;
    }
    setAgentMode("planning");
    setPlanningModeNotice("Planning mode is on. Turn it off when you want to execute a plan.");
  }, []);

  const handleFeedback = useCallback(
    async (feedback: UserFeedback) => {
      await sendFeedback(traceApiBaseUrl, feedback);
    },
    [traceApiBaseUrl]
  );

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((current) => !current);
  }, []);

  const handleApplyOnboardingPrompt = useCallback((prompt: string) => {
    setDraftPrompt(prompt);
    setOnboardingDismissed(true);
    setIsChatOpen(true);
  }, []);

  const handleDismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    setIsChatOpen(true);
  }, []);

  const handleKeepUsingExcalidraw = useCallback(() => {
    setTrialModalDismissed(true);
  }, []);

  const handleCloneRepository = useCallback(() => {
    window.open(REPOSITORY_URL, "_blank", "noopener,noreferrer");
  }, []);

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

  const promptingDisabled = shouldBlockAgentPrompts(trialState);
  const showTrialEndModal = promptingDisabled && !trialModalDismissed && !isStreaming;
  const showOnboarding = messages.length === 0 && !onboardingDismissed;

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
        {showOnboarding && (
          <section className="canvas-onboarding">
            <div className="canvas-onboarding-grid">
              <div className="canvas-onboarding-copy">
                <span className="canvas-onboarding-kicker">Excalibuddy</span>
                <h1>Describe the diagram. Watch it appear on the canvas.</h1>
                <p>
                  Excalibuddy turns simple prompts into native Excalidraw shapes, arrows,
                  and labels. Great for flowcharts, architecture sketches, org charts, and
                  process maps.
                </p>
                <div className="canvas-onboarding-actions">
                  <button
                    type="button"
                    className="canvas-onboarding-primary"
                    onClick={() => handleApplyOnboardingPrompt(TEST_PROMPT)}
                  >
                    Try a sample prompt
                  </button>
                  <button
                    type="button"
                    className="canvas-onboarding-secondary"
                    onClick={handleDismissOnboarding}
                  >
                    Skip intro
                  </button>
                </div>
              </div>
              <div className="canvas-onboarding-prompts">
                <div className="canvas-onboarding-callout">
                  <span className="canvas-onboarding-label">Suggested test prompt</span>
                  <button
                    type="button"
                    className="canvas-onboarding-card canvas-onboarding-card-featured"
                    onClick={() => handleApplyOnboardingPrompt(TEST_PROMPT)}
                  >
                    {TEST_PROMPT}
                  </button>
                </div>
                <div className="canvas-onboarding-callout">
                  <span className="canvas-onboarding-label">More ideas</span>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="canvas-onboarding-card"
                      onClick={() => handleApplyOnboardingPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
      <ChatPanel
        messages={messages}
        sendMessage={sendMessageWithTrace}
        onFeedback={handleFeedback}
        feedbackReadyMessageIds={feedbackReadyMessageIds}
        status={status}
        canRetry={!isStreaming && !promptingDisabled && retryMessage !== null}
        canClearCanvas={!isStreaming && excalidrawAPI !== null}
        isOpen={isChatOpen}
        planningModeEnabled={planningModeEnabled}
        planningModeActive={planningModeEnabled || agentMode === "planning"}
        planningModeNotice={planningModeNotice}
        pendingPlanApproval={pendingPlanApproval}
        promptingDisabled={promptingDisabled}
        draftPrompt={draftPrompt}
        repositoryUrl={REPOSITORY_URL}
        onApprovePlan={handleApprovePlan}
        onPlanningModeToggle={handlePlanningModeToggle}
        onRequestPlanChanges={handleRequestPlanChanges}
        onRetry={handleRetry}
        onClearCanvas={handleClearCanvas}
        onToggleOpen={handleToggleChat}
        onDraftPromptChange={setDraftPrompt}
      />
      <FailureToaster
        notices={failureNotices}
        canRetry={!isStreaming && !promptingDisabled && retryMessage !== null}
        onRetry={handleRetry}
        onDismiss={handleDismissFailureNotice}
      />
      {showTrialEndModal && (
        <TrialEndModal
          onKeepUsingExcalidraw={handleKeepUsingExcalidraw}
          onCloneRepository={handleCloneRepository}
        />
      )}
    </div>
  );
}
