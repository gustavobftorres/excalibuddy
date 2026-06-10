import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadEvalDataset } from "../evals/loadDataset";

const goldenCases = [
  {
    id: "create-simple-03",
    input: "Draw a simple flowchart",
    expectedCharacteristics: ["3 rectangle elements"],
    difficulty: "simple",
    category: "create",
  },
  {
    id: "create-simple-04b",
    input: "Draw a decision flow",
    expectedCharacteristics: ["1 diamond element"],
    difficulty: "simple",
    category: "create",
  },
  {
    id: "modify-01",
    input: "make the login box red",
    expectedCharacteristics: ["Existing box is red"],
    difficulty: "simple",
    category: "modify",
  },
];

const regressionCases = [
  {
    id: "flywheel-login-flow",
    input: "Draw a login flow",
    expectedCharacteristics: ["Includes valid and invalid branches"],
    difficulty: "medium",
    category: "create",
    sourceTraceId: "trace-1",
    feedback: "thumbs_down",
    reviewNotes: "Regression for missing invalid branch",
  },
];

function writeDatasetFixture({
  manifest = [
    { id: "create-simple-04b", rationale: "Decision flow with branching labels." },
    { id: "create-simple-03", rationale: "Core flowchart first impression." },
  ],
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "excalibuddy-evals-"));
  const datasetsDir = join(root, "datasets");
  mkdirSync(datasetsDir);
  writeFileSync(join(datasetsDir, "golden_2.json"), `${JSON.stringify(goldenCases, null, 2)}\n`);
  writeFileSync(join(datasetsDir, "regression.json"), `${JSON.stringify(regressionCases, null, 2)}\n`);
  writeFileSync(join(datasetsDir, "demo-critical.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

test("loadEvalDataset full suite includes golden and regression cases", () => {
  const root = writeDatasetFixture();

  const dataset = loadEvalDataset({ suite: "full", evalsDir: root });

  assert.deepEqual(
    dataset.testCases.map((testCase) => [testCase.id, testCase.source]),
    [
      ["create-simple-03", "golden"],
      ["create-simple-04b", "golden"],
      ["modify-01", "golden"],
      ["flywheel-login-flow", "flywheel"],
    ]
  );
});

test("loadEvalDataset demo-critical suite returns manifest cases in manifest order", () => {
  const root = writeDatasetFixture();

  const dataset = loadEvalDataset({ suite: "demo-critical", evalsDir: root });

  assert.equal(dataset.suite, "demo-critical");
  assert.deepEqual(
    dataset.testCases.map((testCase) => testCase.id),
    ["create-simple-04b", "create-simple-03"]
  );
  assert.deepEqual(
    dataset.testCases.map((testCase) => testCase.source),
    ["demo-critical", "demo-critical"]
  );
  assert.deepEqual(
    dataset.testCases.map((testCase) => testCase.rationale),
    ["Decision flow with branching labels.", "Core flowchart first impression."]
  );
});

test("loadEvalDataset demo-critical suite fails clearly when a manifest id is missing", () => {
  const root = writeDatasetFixture({
    manifest: [{ id: "missing-case", rationale: "Should fail." }],
  });

  assert.throws(
    () => loadEvalDataset({ suite: "demo-critical", evalsDir: root }),
    /demo-critical manifest references missing golden_2 case id: missing-case/
  );
});

test("loadEvalDataset demo-critical suite contains only create cases", () => {
  const dataset = loadEvalDataset({ suite: "demo-critical" });

  assert.equal(dataset.testCases.length, 8);
  assert.deepEqual(
    dataset.testCases.map((testCase) => testCase.id),
    [
      "create-simple-03",
      "create-simple-04b",
      "create-medium-01",
      "create-medium-02",
      "create-medium-03",
      "create-medium-04",
      "create-long-labels",
      "create-vertical-process-straight-arrows",
    ]
  );
  assert.ok(dataset.testCases.every((testCase) => testCase.category === "create"));
});
