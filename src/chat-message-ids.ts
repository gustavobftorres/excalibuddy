export function createOneShotMessageIdGenerator(
  readPendingId: () => string | undefined,
  clearPendingId: () => void,
  fallback: () => string
): () => string {
  return () => {
    const pendingId = readPendingId();
    if (!pendingId) return fallback();

    clearPendingId();
    return pendingId;
  };
}

export function buildMessageRenderKeys(messages: readonly { id: string }[]): string[] {
  const seen = new Map<string, number>();
  return messages.map((message) => {
    const count = seen.get(message.id) ?? 0;
    seen.set(message.id, count + 1);
    return count === 0 ? message.id : `${message.id}#${count + 1}`;
  });
}
