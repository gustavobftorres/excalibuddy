type Fetcher = typeof fetch;

export interface BraintrustConfig {
  apiKey?: string;
  projectId?: string;
  enabled?: string;
}

export interface BraintrustLogEvent {
  id: string;
  input?: unknown;
  output?: unknown;
  expected?: unknown;
  error?: unknown;
  scores?: Record<string, number>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  metrics?: Record<string, unknown>;
}

export interface BraintrustFeedback {
  id: string;
  scores?: Record<string, number>;
  expected?: unknown;
  comment?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function shouldLogTraces(config: BraintrustConfig): boolean {
  if (config.enabled === "false") return false;
  return Boolean(config.apiKey && config.projectId);
}

export async function insertProjectLog({
  apiKey,
  projectId,
  event,
  fetcher = fetch,
}: {
  apiKey: string;
  projectId: string;
  event: BraintrustLogEvent;
  fetcher?: Fetcher;
}): Promise<void> {
  try {
    const response = await fetcher(`https://api.braintrust.dev/v1/project_logs/${projectId}/insert`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ events: [event] }),
    });
    if (!response.ok) {
      console.warn("Braintrust log insert failed", response.status, await response.text());
    }
  } catch (error) {
    console.warn("Braintrust log insert failed", error);
  }
}

export async function logProjectFeedback({
  apiKey,
  projectId,
  feedback,
  fetcher = fetch,
}: {
  apiKey: string;
  projectId: string;
  feedback: BraintrustFeedback;
  fetcher?: Fetcher;
}): Promise<void> {
  try {
    const response = await fetcher(`https://api.braintrust.dev/v1/project_logs/${projectId}/feedback`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ feedback: [feedback] }),
    });
    if (!response.ok) {
      console.warn("Braintrust feedback failed", response.status, await response.text());
    }
  } catch (error) {
    console.warn("Braintrust feedback failed", error);
  }
}
