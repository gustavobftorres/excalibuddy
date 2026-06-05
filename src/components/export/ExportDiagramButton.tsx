import React from "react";

export type ExportStatus = "idle" | "exporting" | "success" | "error";

interface ExportDiagramButtonProps {
  disabled: boolean;
  status: ExportStatus;
  onExport: () => void;
}

function getStatusLabel(status: ExportStatus): string | null {
  if (status === "exporting") return "Preparing";
  if (status === "success") return "Downloaded";
  if (status === "error") return "Export failed";
  return null;
}

export default function ExportDiagramButton({
  disabled,
  status,
  onExport,
}: ExportDiagramButtonProps) {
  const statusLabel = getStatusLabel(status);
  const title = disabled
    ? "Create a diagram before exporting"
    : statusLabel ?? "Download native Excalidraw file";

  return (
    <div className="export-diagram">
      <button
        type="button"
        className={`export-diagram-button export-diagram-button-${status}`}
        disabled={disabled || status === "exporting"}
        onClick={onExport}
        title={title}
        aria-label={title}
      >
        <svg
          aria-hidden="true"
          className="export-diagram-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </button>
    </div>
  );
}
