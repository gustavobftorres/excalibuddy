interface CanvasViewportApi {
  refresh: () => void;
  scrollToContent?: (elements: readonly unknown[], options?: { fitToContent?: boolean }) => void;
}

interface DeferCanvasViewportRefreshOptions {
  scheduleFrame?: (callback: () => void) => void;
}

function scheduleNextFrame(callback: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
}

export function deferCanvasViewportRefresh(
  api: CanvasViewportApi,
  elements?: readonly unknown[],
  options: DeferCanvasViewportRefreshOptions = {}
): Promise<void> {
  const scheduleFrame = options.scheduleFrame ?? scheduleNextFrame;
  return new Promise((resolve) => {
    scheduleFrame(() => {
      api.refresh();
      if (elements && elements.length > 0) {
        api.scrollToContent?.(elements, { fitToContent: true });
      }
      resolve();
    });
  });
}
