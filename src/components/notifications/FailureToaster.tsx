import type { AgentFailureNotice } from "../../agent-failures";
import "./failure-toaster.css";

interface FailureToasterProps {
  notices: AgentFailureNotice[];
  canRetry: boolean;
  onRetry: () => void;
  onDismiss: (id: string) => void;
}

export default function FailureToaster({
  notices,
  canRetry,
  onRetry,
  onDismiss,
}: FailureToasterProps) {
  if (notices.length === 0) return null;

  return (
    <div className="failure-toaster" role="region" aria-label="Agent notifications">
      {notices.map((notice) => (
        <div key={notice.id} className={`failure-toast ${notice.kind}`} role="status">
          <div className="failure-toast-mark" aria-hidden="true" />
          <div className="failure-toast-body">
            <p className="failure-toast-title">{notice.title}</p>
            <p className="failure-toast-description">{notice.description}</p>
          </div>
          <div className="failure-toast-actions">
            <button
              type="button"
              className="failure-toast-action"
              onClick={onRetry}
              disabled={!canRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="failure-toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(notice.id)}
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
