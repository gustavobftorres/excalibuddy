#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegressionCases } from "./flywheel-utils.mjs";

const CANDIDATES_PATH = join("evals", "datasets", "flywheel-candidates.json");
const REGRESSION_PATH = join("evals", "datasets", "regression.json");

const approvedIds = process.argv.slice(2);
if (approvedIds.length === 0) {
  console.error("Usage: node scripts/promote-flywheel-case.mjs <sourceTraceId|suggestedId> [...]");
  process.exit(1);
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8"));
}

const candidates = readJson(CANDIDATES_PATH, []);
const selected = candidates.filter(
  (candidate) =>
    approvedIds.includes(candidate.sourceTraceId) ||
    approvedIds.includes(candidate.suggested?.id)
);

if (selected.length === 0) {
  console.error(`No matching candidates found in ${CANDIDATES_PATH}`);
  process.exit(1);
}

const promoted = buildRegressionCases(selected);
const existing = readJson(REGRESSION_PATH, []);
const byId = new Map(existing.map((testCase) => [testCase.id, testCase]));

for (const testCase of promoted) {
  byId.set(testCase.id, testCase);
}

const next = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(REGRESSION_PATH, `${JSON.stringify(next, null, 2)}\n`);

console.log(`Promoted ${promoted.length} cases to ${REGRESSION_PATH}`);
