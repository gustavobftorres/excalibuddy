export interface PlanApprovalPayload {
  title: string;
  summary: string;
  steps: string[];
  assumptions: string[];
  questions: string[];
}

export interface PlanningGateInput {
  planningModeEnabled: boolean;
  sceneElementCount: number;
  hasPriorAssistantMessages: boolean;
  pendingPlanApproval: boolean;
}
