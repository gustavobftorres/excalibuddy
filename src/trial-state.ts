export const PROMPT_LIMIT = 5;
export const TRIAL_STORAGE_KEY = "excalibuddy-trial-state";

export interface TrialState {
  promptCount: number;
  trialEnded: boolean;
}

export const DEFAULT_TRIAL_STATE: TrialState = {
  promptCount: 0,
  trialEnded: false,
};

function normalizePromptCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function getTrialStateFromStorage(raw: string | null): TrialState {
  if (!raw) return DEFAULT_TRIAL_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<TrialState>;
    const promptCount = normalizePromptCount(parsed.promptCount);
    const trialEnded = parsed.trialEnded === true;

    if (trialEnded && promptCount < PROMPT_LIMIT) {
      return { promptCount: PROMPT_LIMIT, trialEnded: true };
    }

    return {
      promptCount,
      trialEnded: trialEnded || promptCount >= PROMPT_LIMIT,
    };
  } catch {
    return DEFAULT_TRIAL_STATE;
  }
}

export function recordTrialPrompt(state: TrialState, limit = PROMPT_LIMIT): TrialState {
  if (state.trialEnded || state.promptCount >= limit) {
    return {
      promptCount: Math.max(state.promptCount, limit),
      trialEnded: true,
    };
  }

  const promptCount = state.promptCount + 1;
  return {
    promptCount,
    trialEnded: promptCount >= limit,
  };
}

export function shouldBlockAgentPrompts(state: TrialState): boolean {
  return state.trialEnded;
}
