interface TrialEndModalProps {
  onKeepUsingExcalidraw: () => void;
  onCloneRepository: () => void;
}

export default function TrialEndModal({
  onKeepUsingExcalidraw,
  onCloneRepository,
}: TrialEndModalProps) {
  return (
    <div className="trial-modal-backdrop" role="presentation">
      <div
        className="trial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-modal-title"
        aria-describedby="trial-modal-description"
      >
        <span className="trial-modal-kicker">Hosted trial finished</span>
        <h2 id="trial-modal-title">You have used all 5 hosted AI prompts.</h2>
        <p id="trial-modal-description">
          You can keep working on the canvas manually, or clone the repository to run Excalibuddy
          locally with the full agent experience.
        </p>
        <div className="trial-modal-actions">
          <button type="button" className="trial-modal-secondary" onClick={onKeepUsingExcalidraw}>
            Keep using Excalidraw
          </button>
          <button type="button" className="trial-modal-primary" onClick={onCloneRepository}>
            Clone repository to use locally
          </button>
        </div>
      </div>
    </div>
  );
}
