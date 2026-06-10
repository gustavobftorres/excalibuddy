# Release Checklist

Use this checklist before publishing a release or demo-facing change.

## Required checks

- Run `npm test`.
- Run `npm run build`.
- Run `npm run eval` before releases that affect the agent, tools, prompts, evals, or canvas rendering.
- In Braintrust, confirm promoted flywheel regressions appear in the eval run with `source: "flywheel"` when `evals/datasets/regression.json` contains cases.

## Publishable eval thresholds

These thresholds are a human release baseline, not an automated gate. Treat unexplained drops as blockers until reviewed.

| Scorer | Full suite minimum | Demo suite minimum | Release guidance |
|---|---:|---:|---|
| `Schema` | `1.00` | `1.00` | Required. Any schema failure blocks release. |
| `ToolChoice` | `>= 0.95` | `1.00` | Demo cases must use the expected tools every time. |
| `BoundLabels` | `>= 0.90` | `>= 0.95` | Labels should visibly belong to their shapes. |
| `BoundArrows` | `>= 0.90` | `>= 0.95` | Connected diagrams should not have floating arrows. |
| `LabelRenderBounds` | `>= 0.90` | `>= 0.95` | Text should not render clipped or unreadable. |
| `ArrowAnchorGeometry` | `>= 0.90` | `>= 0.95` | Straight connectors should land on stable edge anchors. |
| `Connectivity` | `>= 0.90` | `>= 0.95` | Flow, architecture, and sequence diagrams should not leave orphan shapes. |
| `NoOverlaps` | `>= 0.90` | `>= 0.95` | Layout should avoid obvious collisions. |
| `LabelKeywords` | `>= 0.85` | `>= 0.85` | Investigate drops; do not block if a new/noisy case explains the miss. |
| `Structure` | `>= 0.85` | `>= 0.85` | Investigate drops; do not block if the count heuristic is not applicable. |
| `VerifyCanvasUsage` | `1.00` where scored | `1.00` where scored | Any applicable connected mutation should call `verifyCanvas` after mutation. |

## Blocking failures

- Any `Schema` score below `1.00`.
- Any `demo-critical` case that produces no renderable elements.
- `npm run eval:demo` failures involving missing visible labels, disconnected arrows, disconnected flow, or obvious overlaps.
- A promoted flywheel regression that fails again for the same reason recorded in `reviewNotes`.
- Runtime errors or failed exits from `npm test`, `npm run build`, or `npm run eval`.

## Manual canvas smoke tests

Run the app locally and manually check these prompts before sharing the public demo:

```text
Draw a simple flowchart with Start, Process, and End boxes connected by arrows
Draw a login flow: user enters credentials, system validates, if valid go to dashboard, if invalid show error
Draw a simple web architecture: Browser sends requests to a Load Balancer, which forwards to two Web Servers, which read from a Database
```

For each smoke test, verify that labels render inside their shapes, arrows are connected, related shapes are connected as a diagram, there are no obvious overlaps, and text is not clipped. Use the diagram viewer or export flow when reviewing pasted eval output from Braintrust.

## Demo checks

- Run `npm run eval:demo` when the change affects the public demo's first-run create-from-scratch path.
- Use `npm run eval:demo:inspect` when you only need to inspect the current demo-critical prompt list without calling the model/API.

## Flywheel regression flow

Promoted production-derived cases live in `evals/datasets/regression.json`. The default eval suite loaded by `npm run eval` includes those cases alongside `golden_2.json`, so promoted regressions participate in the normal eval gate instead of requiring a separate command.
