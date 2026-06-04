import { useState } from "react";
import type { UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";
import ToolStatus from "../streaming/ToolStatus";
import PlanApprovalCard from "../hitl/PlanApprovalCard";
import type { PlanApprovalPayload } from "../../planning/types";
import { getMessageMetadata } from "../../flywheel/client";
import type { UserFeedback } from "../../flywheel/types";
import "../streaming/streaming.css";

interface MessageBubbleProps {
  message: UIMessage;
  onFeedback: (feedback: UserFeedback) => Promise<void>;
  feedbackReady: boolean;
}

export default function MessageBubble({ message, onFeedback, feedbackReady }: MessageBubbleProps) {
  const [feedbackState, setFeedbackState] = useState<"idle" | "commenting" | "submitted">("idle");
  const [comment, setComment] = useState("");
  const metadata = getMessageMetadata(message);
  const hasPlanApprovalTool = (message.parts ?? []).some(
    (part) => part.type === "tool-requestPlanApproval"
  );
  const seenAssistantTextParts = new Set<string>();

  const submitFeedback = async (rating: 1 | 0, feedbackComment?: string) => {
    if (!metadata.turnId || !metadata.sessionId) return;
    setFeedbackState("submitted");
    await onFeedback({
      turnId: metadata.turnId,
      rating,
      comment: feedbackComment,
      assistantMessageId: message.id,
      sessionId: metadata.sessionId,
    });
  };

  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-role">
        {message.role === "user" ? "You" : "Assistant"}
      </div>
      <div className="message-content">
        {message.parts?.map((part, i) => {
          // Plain text part
          if (part.type === "text") {
            if (message.role === "assistant" && hasPlanApprovalTool) return null;
            if (message.role === "assistant") {
              const normalizedText = part.text.trim();
              if (normalizedText.length === 0) return null;
              if (seenAssistantTextParts.has(normalizedText)) return null;
              seenAssistantTextParts.add(normalizedText);
            }
            if (message.role === "assistant") {
              return <MarkdownRenderer key={i} content={part.text} />;
            }
            return <p key={i}>{part.text}</p>;
          }

          // Tool call part: type is `tool-<toolName>` (e.g. tool-generateDiagram)
          if (part.type?.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            const toolPart = part as { state?: string; input?: unknown };
            const status =
              toolPart.state === "output-available"
                ? "complete"
                : toolPart.state === "output-error"
                  ? "error"
                  : "running";
            if (
              toolName === "requestPlanApproval" &&
              toolPart.state === "output-available" &&
              toolPart.input
            ) {
              return <PlanApprovalCard key={i} plan={toolPart.input as PlanApprovalPayload} />;
            }
            return <ToolStatus key={i} name={toolName} status={status} />;
          }

          return null;
        })}
      </div>
      {message.role === "assistant" && metadata.turnId && feedbackReady && (
        <div className="message-feedback">
          {feedbackState === "submitted" ? (
            <span className="feedback-sent">Feedback saved</span>
          ) : (
            <>
              <button
                type="button"
                className="feedback-btn"
                aria-label="Mark response as helpful"
                title="Helpful"
                onClick={() => void submitFeedback(1)}
              >
                👍
              </button>
              <button
                type="button"
                className="feedback-btn"
                aria-label="Mark response as not helpful"
                title="Not helpful"
                onClick={() => setFeedbackState("commenting")}
              >
                👎
              </button>
            </>
          )}
        </div>
      )}
      {feedbackState === "commenting" && (
        <form
          className="feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitFeedback(0, comment.trim() || undefined);
          }}
        >
          <input
            className="feedback-input"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What was wrong?"
          />
          <button type="submit" className="feedback-submit">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
