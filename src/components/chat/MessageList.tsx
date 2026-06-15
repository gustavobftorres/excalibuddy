import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import MessageBubble from "./MessageBubble";
import type { UserFeedback } from "../../flywheel/types";
import { buildMessageRenderKeys } from "../../chat-message-ids";

interface MessageListProps {
  messages: UIMessage[];
  onFeedback: (feedback: UserFeedback) => Promise<void>;
  feedbackReadyMessageIds: Set<string>;
}

export default function MessageList({
  messages,
  onFeedback,
  feedbackReadyMessageIds,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messageKeys = buildMessageRenderKeys(messages);
  // Track whether the user was at (or near) the bottom before the last update
  // so we only auto scroll when they were already following along.
  const wasAtBottomRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 50;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <p className="placeholder-text">
          Describe a diagram and the AI will create it for you.
        </p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      {messages.map((msg, index) => (
        <MessageBubble
          key={messageKeys[index]}
          message={msg}
          onFeedback={onFeedback}
          feedbackReady={feedbackReadyMessageIds.has(msg.id)}
        />
      ))}
    </div>
  );
}
