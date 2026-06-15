import React, { type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ChatToolToggleProps {
  label: string;
  tooltip: string;
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  onToggle: () => void;
}

export default function ChatToolToggle({
  label,
  tooltip,
  active,
  disabled,
  icon,
  onToggle,
}: ChatToolToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} ${active ? "enabled" : "disabled"}`}
          aria-pressed={active}
          className={`chat-tool-button ${active ? "active" : "inactive"}`}
          disabled={disabled}
          onClick={onToggle}
          title={tooltip}
        >
          <span className="chat-tool-button-icon" aria-hidden="true">
            {icon}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
