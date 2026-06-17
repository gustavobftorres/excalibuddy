# Flywheel Triage And Promotion Ritual

Use this ritual to turn production feedback into regression coverage. The goal is not to train the model automatically. The goal is to move real user failures into the offline eval suite so future agent, prompt, tool, and canvas changes are measured against production reality.

## When To Run This

Run the ritual before release work, after demo sessions, and any time production feedback accumulates enough useful signal to review.

Good triggers:

- Several `thumbs_down` responses landed in production.
- A demo exposed a diagram failure that should not regress again.
- A release candidate changes prompts, tools, canvas rendering, evals, or agent behavior.
- The release checklist says promoted flywheel regressions need review.

## Prerequisites

Production feedback must already be logged to Braintrust. The local `.dev.vars` file must contain:

```bash
BRAINTRUST_API_KEY=...
BRAINTRUST_PROJECT_ID=...
```

The export script also accepts those variables from the shell environment. The app records feedback as the Braintrust score `user_feedback`, where `0` means `thumbs_down` and `1` means `thumbs_up`.

## Files And Scripts

| Purpose | Path or command |
|---|---|
| Export production candidates | `npm run flywheel:export` |
| Candidate queue | `evals/datasets/flywheel-candidates.json` |
| Promote reviewed candidates | `npm run flywheel:promote -- <sourceTraceId-or-suggestedId>` |
| Promoted regression cases | `evals/datasets/regression.json` |
| Run full eval suite | `npm run eval` |
| Eval dataset loader | `evals/loadDataset.ts` |

The default eval suite already loads `evals/datasets/regression.json` alongside `evals/datasets/golden_2.json`. No separate eval command is required after promotion.

## Step 1: Export Candidates

From the project root, run:

```bash
npm run flywheel:export
```

By default this queries the last 14 days of Braintrust traces tagged `diagram-agent` and writes:

```text
evals/datasets/flywheel-candidates.json
```

To change the lookback window, pass a day count to the underlying script:

```bash
node scripts/export-flywheel-candidates.mjs 30
```

The export selects traces when they carry useful review signals:

- `thumbs_down`
- unusual long prompt with `thumbs_up`
- logged error
- high latency
- many tool calls
- output containing overlap feedback

## Step 2: Review The Queue

Open `evals/datasets/flywheel-candidates.json` and review candidates one at a time.

Prioritize `reasons` containing `thumbs_down`. For each candidate, inspect:

- `sourceTraceId`
- `userInput`
- `finalText`
- `toolCalls`
- `feedback`
- `comment`
- `suggested`

A candidate is worth promoting when it represents behavior we want to protect from regression. Do not promote noisy feedback when the user request was unclear, the complaint cannot be translated into an eval expectation, or the case duplicates an existing regression.

## Step 3: Rewrite The Suggested Case

Before promoting, edit the candidate's `suggested` block so it describes the corrected expected behavior.

For a `thumbs_down`, replace the placeholder characteristic:

```json
"Human reviewer should replace this with the corrected expected behavior before promotion"
```

with concrete expectations:

```json
{
  "id": "flywheel-login-error-branch",
  "expectedCharacteristics": [
    "Includes both successful and failed login branches",
    "Shows invalid credentials leading to an error message",
    "Keeps the happy path connected to the dashboard"
  ],
  "expectedKeywords": ["login", "invalid", "error", "dashboard"],
  "difficulty": "medium",
  "category": "create",
  "reviewNotes": "Promoted from thumbs_down because the original diagram omitted the invalid credentials branch."
}
```

Use the existing eval categories from `evals/buildMessages.ts`:

- `create`
- `modify`
- `domain`

Use the existing difficulty values:

- `easy`
- `medium`
- `hard`

Keep `reviewNotes` specific. A future failure should be understandable without reopening Braintrust.

## Step 4: Promote Approved Cases

Promote by `sourceTraceId` or by the edited `suggested.id`:

```bash
npm run flywheel:promote -- trace-123
```

or:

```bash
npm run flywheel:promote -- flywheel-login-error-branch
```

To promote multiple reviewed cases at once:

```bash
npm run flywheel:promote -- trace-123 flywheel-login-error-branch
```

The script writes promoted cases into:

```text
evals/datasets/regression.json
```

It merges by `id`, so rerunning promotion for the same reviewed case updates that regression instead of creating a duplicate.

## Step 5: Run Evals After Promotion

After promotion, run:

```bash
npm run eval
```

In Braintrust, confirm promoted cases appear with:

```text
source: flywheel
```

Treat a promoted regression that fails for the same reason recorded in `reviewNotes` as a blocker for release work. If the promoted case fails for a new reason, update `reviewNotes` or split it into a separate case before merging.

## Step 6: Commit The Reviewed Regression Set

Commit the reviewed dataset changes together:

```bash
git add evals/datasets/flywheel-candidates.json evals/datasets/regression.json
git commit -m "test: promote flywheel regression cases"
```

If `flywheel-candidates.json` contains private review notes that should not ship, commit only `evals/datasets/regression.json` and keep the candidate file local:

```bash
git add evals/datasets/regression.json
git commit -m "test: promote flywheel regression cases"
```

## Troubleshooting

### `BRAINTRUST_API_KEY is required`

Add `BRAINTRUST_API_KEY` to `.dev.vars` or export it in the shell.

### `BRAINTRUST_PROJECT_ID is required`

Add `BRAINTRUST_PROJECT_ID` to `.dev.vars` or export it in the shell.

### `No matching candidates found`

Check that the id you passed exists in `evals/datasets/flywheel-candidates.json`. The promote script accepts either `sourceTraceId` or `suggested.id`.

### Export Writes Zero Candidates

Zero candidates can be valid when no recent traces match the selection rules. Try a wider lookback:

```bash
node scripts/export-flywheel-candidates.mjs 30
```

If the wider export is still empty, confirm production trace logging and feedback are enabled before assuming the agent has no failures.

## Definition Of Done

A flywheel triage pass is complete when:

- Candidates were exported from Braintrust.
- `thumbs_down` candidates were reviewed first.
- Approved candidates have concrete `expectedCharacteristics`.
- Approved cases were promoted to `evals/datasets/regression.json`.
- `npm run eval` ran after promotion.
- Braintrust shows promoted cases with `source: flywheel`.
