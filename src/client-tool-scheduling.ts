export function deferClientToolExecution(
  schedule: (callback: () => void) => void = (callback) => setTimeout(callback, 0)
): Promise<void> {
  return new Promise((resolve) => {
    schedule(resolve);
  });
}

export function getClientToolErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Client tool execution failed";
}
