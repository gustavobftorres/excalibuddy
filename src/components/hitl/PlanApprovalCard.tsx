import React from "react";
import { useState } from "react";
import type { PlanApprovalPayload } from "../../planning/types";

interface PlanApprovalCardProps {
  plan: PlanApprovalPayload;
}

export default function PlanApprovalCard({ plan }: PlanApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="plan-approval-card">
      <button
        type="button"
        className="plan-approval-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="plan-approval-toggle-copy">
          <p className="plan-approval-kicker">Planning phase</p>
          <h3 className="plan-approval-title">{plan.title}</h3>
          <p className="plan-approval-summary">{plan.summary}</p>
        </div>
        <span className={`plan-approval-chevron ${expanded ? "expanded" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {expanded && (
        <div className="plan-approval-body">
          <div className="plan-approval-section">
            <span className="plan-approval-label">Build steps</span>
            <ol className="plan-approval-list">
              {plan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {plan.assumptions.length > 0 && (
            <div className="plan-approval-section">
              <span className="plan-approval-label">Assumptions</span>
              <ul className="plan-approval-list">
                {plan.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.questions.length > 0 && (
            <div className="plan-approval-section">
              <span className="plan-approval-label">Open questions</span>
              <ul className="plan-approval-list">
                {plan.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
