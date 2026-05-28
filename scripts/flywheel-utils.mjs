const DEFAULT_OPTIONS = {
  latencyThresholdMs: 20_000,
  promptLengthThreshold: 180,
  toolCallThreshold: 6,
};

function getUserInput(row) {
  if (typeof row?.input?.userInput === "string") return row.input.userInput;
  if (typeof row?.input === "string") return row.input;
  if (typeof row?.metadata?.userInput === "string") return row.metadata.userInput;
  return "";
}

function getFinalText(row) {
  if (typeof row?.output?.finalText === "string") return row.output.finalText;
  if (typeof row?.output?.text === "string") return row.output.text;
  if (typeof row?.output === "string") return row.output;
  return "";
}

function getToolCalls(row) {
  if (Array.isArray(row?.output?.toolCalls)) return row.output.toolCalls;
  if (Array.isArray(row?.metadata?.toolCalls)) return row.metadata.toolCalls;
  return [];
}

function getLatencyMs(row) {
  if (typeof row?.metrics?.latencyMs === "number") return row.metrics.latencyMs;
  if (typeof row?.metrics?.start === "number" && typeof row?.metrics?.end === "number") {
    return row.metrics.end - row.metrics.start;
  }
  return 0;
}

function getFeedback(row) {
  const score = row?.scores?.user_feedback;
  if (score === 0) return "thumbs_down";
  if (score === 1) return "thumbs_up";
  return "none";
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "case";
}

function defaultSuggestedCase(row, userInput, feedback) {
  return {
    id: `flywheel-${slugify(row.id ?? userInput)}`,
    expectedCharacteristics: [
      feedback === "thumbs_down"
        ? "Human reviewer should replace this with the corrected expected behavior before promotion"
        : "Human reviewer should replace this with the expected behavior before promotion",
    ],
    difficulty: "medium",
    category: "create",
    reviewNotes: row.comment ?? "",
  };
}

export function buildCandidateRecords(rows, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return rows.flatMap((row) => {
    const userInput = getUserInput(row);
    const finalText = getFinalText(row);
    const toolCalls = getToolCalls(row);
    const feedback = getFeedback(row);
    const reasons = [];

    if (feedback === "thumbs_down") reasons.push("thumbs_down");
    if (feedback === "thumbs_up" && userInput.length >= config.promptLengthThreshold) {
      reasons.push("unusual_prompt");
    }
    if (row?.error) reasons.push("error");
    if (getLatencyMs(row) >= config.latencyThresholdMs) reasons.push("high_latency");
    if (toolCalls.length >= config.toolCallThreshold) reasons.push("many_tool_calls");
    if (JSON.stringify(row?.output ?? {}).includes("overlaps")) reasons.push("overlap_feedback");

    if (reasons.length === 0) return [];

    return [
      {
        sourceTraceId: String(row.id),
        userInput,
        finalText,
        toolCalls,
        feedback,
        comment: row.comment,
        reasons,
        suggested: defaultSuggestedCase(row, userInput, feedback),
      },
    ];
  });
}

export function buildRegressionCases(candidates) {
  return candidates.map((candidate) => {
    if (!candidate.suggested?.id) {
      throw new Error(`Candidate ${candidate.sourceTraceId} is missing suggested.id`);
    }
    if (!Array.isArray(candidate.suggested.expectedCharacteristics)) {
      throw new Error(`Candidate ${candidate.sourceTraceId} is missing expectedCharacteristics`);
    }
    if (candidate.feedback === "none") {
      throw new Error(`Candidate ${candidate.sourceTraceId} must have thumbs_up or thumbs_down feedback`);
    }

    return {
      id: candidate.suggested.id,
      input: candidate.userInput,
      expectedCharacteristics: candidate.suggested.expectedCharacteristics,
      ...(candidate.suggested.expectedKeywords
        ? { expectedKeywords: candidate.suggested.expectedKeywords }
        : {}),
      difficulty: candidate.suggested.difficulty,
      category: candidate.suggested.category,
      sourceTraceId: candidate.sourceTraceId,
      feedback: candidate.feedback,
      reviewNotes: candidate.suggested.reviewNotes,
    };
  });
}
