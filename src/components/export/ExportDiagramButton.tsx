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
    : "Download native Excalidraw file";

  return (
    <div className="export-diagram">
      <button
        type="button"
        className="export-diagram-button"
        disabled={disabled || status === "exporting"}
        onClick={onExport}
        title={title}
        aria-label={title}
      >
        <span aria-hidden="true" className="export-diagram-icon">
          ↓
        </span>
        <span>Export</span>
      </button>
      {statusLabel && (
        <span className={`export-diagram-status export-diagram-status-${status}`}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}
