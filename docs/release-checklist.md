# Release Checklist

Use this checklist before publishing a release or demo-facing change.

## Required checks

- Run `npm test`.
- Run `npm run build`.
- Run `npm run eval` before releases that affect the agent, tools, prompts, evals, or canvas rendering.
- In Braintrust, confirm promoted flywheel regressions appear in the eval run with `source: "flywheel"` when `evals/datasets/regression.json` contains cases.

## Demo checks

- Run `npm run eval:demo` when the change affects the public demo's first-run create-from-scratch path.
- Use `npm run eval:demo:inspect` when you only need to inspect the current demo-critical prompt list without calling the model/API.

## Flywheel regression flow

Promoted production-derived cases live in `evals/datasets/regression.json`. The default eval suite loaded by `npm run eval` includes those cases alongside `golden_2.json`, so promoted regressions participate in the normal eval gate instead of requiring a separate command.
