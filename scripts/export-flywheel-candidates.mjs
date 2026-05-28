#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildCandidateRecords } from "./flywheel-utils.mjs";

const OUT_PATH = join("evals", "datasets", "flywheel-candidates.json");

function loadDevVars() {
  try {
    const vars = {};
    const content = readFileSync(".dev.vars", "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key) vars[key.trim()] = rest.join("=").trim();
    }
    return vars;
  } catch {
    return {};
  }
}

function requireEnv(name, vars) {
  const value = process.env[name] ?? vars[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function queryBraintrustLogs({ apiKey, projectId, days }) {
  const query = `
SELECT id, input, output, scores, comment, metadata, metrics, error
FROM project_logs('${projectId}', shape => 'traces')
WHERE tags INCLUDES 'diagram-agent'
  AND created > now() - interval ${days} day
LIMIT 500
`;

  const response = await fetch("https://api.braintrust.dev/btql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, fmt: "json" }),
  });

  if (!response.ok) {
    throw new Error(`Braintrust query failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

const vars = loadDevVars();
const apiKey = requireEnv("BRAINTRUST_API_KEY", vars);
const projectId = requireEnv("BRAINTRUST_PROJECT_ID", vars);
const days = Number(process.argv[2] ?? 14);

const rows = await queryBraintrustLogs({ apiKey, projectId, days });
const candidates = buildCandidateRecords(rows);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(candidates, null, 2)}\n`);

console.log(`Wrote ${candidates.length} candidates to ${OUT_PATH}`);
