import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import { useRef, useCallback } from "react";
import { createElementCountNotifier, getVisibleElementCount } from "./canvas-element-count";

interface CanvasProps {
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  onElementCountChange?: (count: number) => void;
  onThemeChange?: (theme: "light" | "dark") => void;
}

export default function Canvas({
  onApiReady,
  onElementCountChange,
  onThemeChange,
}: CanvasProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const lastTheme = useRef<string>("light");
  const onElementCountChangeRef = useRef(onElementCountChange);
  onElementCountChangeRef.current = onElementCountChange;
  const elementCountNotifierRef = useRef(
    createElementCountNotifier((count) => onElementCountChangeRef.current?.(count))
  );

  const handleMount = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      onApiReady?.(api);
      elementCountNotifierRef.current(getVisibleElementCount(api.getSceneElements()));
    },
    [onApiReady]
  );

  const handleChange = useCallback(
    (elements: readonly any[], appState: AppState) => {
      elementCountNotifierRef.current(getVisibleElementCount(elements));
      if (appState.theme !== lastTheme.current) {
        lastTheme.current = appState.theme;
        onThemeChange?.(appState.theme as "light" | "dark");
      }
    },
    [onThemeChange]
  );

  return (
    <div className="canvas-wrapper">
      <Excalidraw
        excalidrawAPI={handleMount}
        initialData={{ appState: { openSidebar: null } }}
        onChange={handleChange}
      />
    </div>
  );
}
