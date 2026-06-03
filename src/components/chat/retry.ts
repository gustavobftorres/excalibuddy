import type { UIMessage } from "ai";

import { getMessageText } from "../../flywheel/client";

export function getRetryMessage(
  messages: UIMessage[]
): { role: "user"; parts: { type: "text"; text: string }[] } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "user") continue;
    const text = getMessageText(message).trim();
    if (!text) continue;
    return {
      role: "user",
      parts: [{ type: "text", text }],
    };
  }
  return null;
}
