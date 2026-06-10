import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { GoldenTestCase } from "./buildMessages";

export type EvalSuite = "full" | "demo-critical";
export type EvalCaseSource = "golden" | "flywheel" | "demo-critical";

export type FlywheelRegressionCase = GoldenTestCase & {
  sourceTraceId: string;
  feedback: "thumbs_down" | "thumbs_up";
  reviewNotes: string;
};

export type DemoCriticalManifestCase = {
  id: string;
  rationale: string;
};

export type LoadedEvalCase = (GoldenTestCase | FlywheelRegressionCase) & {
  source: EvalCaseSource;
  rationale?: string;
};

export type LoadedEvalDataset = {
  suite: EvalSuite;
  testCases: LoadedEvalCase[];
};

function readJson<T>(evalsDir: string, filename: string): T {
  return JSON.parse(readFileSync(join(evalsDir, "datasets", filename), "utf-8")) as T;
}

function parseSuite(value: string | undefined): EvalSuite {
  if (!value || value === "full") return "full";
  if (value === "demo-critical") return "demo-critical";
  throw new Error(`Unsupported EVAL_SUITE: ${value}`);
}

export function getEvalSuiteFromEnv(env: { EVAL_SUITE?: string } = process.env): EvalSuite {
  return parseSuite(env.EVAL_SUITE);
}

export function loadEvalDataset({
  suite = getEvalSuiteFromEnv(),
  evalsDir = "evals",
}: {
  suite?: EvalSuite;
  evalsDir?: string;
} = {}): LoadedEvalDataset {
  const goldenCases = readJson<GoldenTestCase[]>(evalsDir, "golden_2.json");

  if (suite === "demo-critical") {
    const manifest = readJson<DemoCriticalManifestCase[]>(evalsDir, "demo-critical.json");
    const goldenById = new Map(goldenCases.map((testCase) => [testCase.id, testCase]));

    return {
      suite,
      testCases: manifest.map((entry) => {
        const testCase = goldenById.get(entry.id);
        if (!testCase) {
          throw new Error(`demo-critical manifest references missing golden_2 case id: ${entry.id}`);
        }
        return { ...testCase, source: "demo-critical", rationale: entry.rationale };
      }),
    };
  }

  const regressionCases = readJson<FlywheelRegressionCase[]>(evalsDir, "regression.json");

  return {
    suite,
    testCases: [
      ...goldenCases.map((testCase) => ({ ...testCase, source: "golden" as const })),
      ...regressionCases.map((testCase) => ({ ...testCase, source: "flywheel" as const })),
    ],
  };
}
