import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import { useRef, useCallback } from "react";

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

  const handleMount = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      onApiReady?.(api);
      onElementCountChange?.(api.getSceneElements().filter((element) => !element.isDeleted).length);
    },
    [onApiReady, onElementCountChange]
  );

  const handleChange = useCallback(
    (elements: readonly any[], appState: AppState) => {
      onElementCountChange?.(elements.filter((element) => !element.isDeleted).length);
      if (appState.theme !== lastTheme.current) {
        lastTheme.current = appState.theme;
        onThemeChange?.(appState.theme as "light" | "dark");
      }
    },
    [onElementCountChange, onThemeChange]
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
