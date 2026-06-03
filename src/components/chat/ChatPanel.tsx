import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import MessageList from "./MessageList";
import type { UserFeedback } from "../../flywheel/types";
import "./chat.css";

interface ChatPanelProps {
  messages: UIMessage[];
  sendMessage: (message: { role: "user"; parts: { type: "text"; text: string }[] }) => void;
  onFeedback: (feedback: UserFeedback) => Promise<void>;
  feedbackReadyMessageIds: Set<string>;
  status: string;
  canRetry: boolean;
  canClearCanvas: boolean;
  isOpen: boolean;
  promptingDisabled: boolean;
  repositoryUrl: string;
  onRetry: () => void;
  onClearCanvas: () => void;
  onToggleOpen: () => void;
}

export default function ChatPanel({
  messages,
  sendMessage,
  onFeedback,
  feedbackReadyMessageIds,
  status,
  canRetry,
  canClearCanvas,
  isOpen,
  promptingDisabled,
  repositoryUrl,
  onRetry,
  onClearCanvas,
  onToggleOpen,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptingDisabled || !input.trim()) return;
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });
    setInput("");
  };

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div className="chat-overlay">
      <aside className={`chat-panel ${isOpen ? "open" : "closed"}`}>
        <div className="chat-header">
          <div className="chat-header-row">
            <h2>Chat</h2>
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-header-btn"
                onClick={onRetry}
                disabled={!canRetry}
              >
                Retry
              </button>
              <button
                type="button"
                className="chat-header-btn"
                onClick={onClearCanvas}
                disabled={!canClearCanvas}
              >
                Clear canvas
              </button>
            </div>
          </div>
        </div>
        <MessageList
          messages={messages}
          onFeedback={onFeedback}
          feedbackReadyMessageIds={feedbackReadyMessageIds}
        />
        {promptingDisabled && (
          <p className="chat-trial-note">
            Hosted AI prompting is no longer available here. You can keep editing manually, or{" "}
            <a href={repositoryUrl} target="_blank" rel="noreferrer">
              clone the repository to use it locally
            </a>
            .
          </p>
        )}
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={
              promptingDisabled
                ? "Hosted AI prompting has ended for this browser."
                : "Describe a diagram..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming || promptingDisabled}
            rows={1}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={isStreaming || promptingDisabled || !input.trim()}
            aria-label={isStreaming ? "Sending" : "Send message"}
          >
            {isStreaming ? (
              <span className="chat-send-dots" aria-hidden="true">
                ...
              </span>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="chat-send-icon">
                <path
                  d="M4 10H16M16 10L11 5M16 10L11 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </form>
      </aside>
      <button
        type="button"
        className="chat-toggle"
        onClick={onToggleOpen}
        aria-label={isOpen ? "Collapse chat" : "Open chat"}
        title={isOpen ? "Collapse chat" : "Open chat"}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`chat-toggle-icon ${isOpen ? "open" : "closed"}`}
        >
          <path
            d="M7 4L13 10L7 16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
