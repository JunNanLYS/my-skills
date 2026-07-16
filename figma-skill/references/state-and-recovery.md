# PlanWeave State and Recovery

PlanWeave is the figma-skill v3 state authority. `.figma/screenshot` and `.figma/feedback` are evidence artifacts only and never decide task state.

## State Authority

Use PlanWeave CLI and skills as the source of truth:

```bash
planweave status --json
planweave current --json
planweave claim --json
planweave prompt --json
planweave submit-block --json
planweave submit-review --json
```

If PlanWeave state is stale, diverged, blocked, or has invalid current refs, use the `plan-recovery` skill or PlanWeave recovery commands. Do not hand-edit PlanWeave runtime state or results.

## Recovery Rules

- Spec review fails → return to the named requirements, design-system, live-context, or spec block.
- Plan review fails → return to Plan Draft Block.
- Pre-write live-revalidate finds drift → return to Plan Draft or Spec Draft according to drift source.
- Write block fails → submit failure evidence to the responsible block and let PlanWeave route retry or recovery.
- Geometry validation fails → Correction Block, then rerun Geometry Validation Block.
- Visual validation fails → Correction Block, then rerun Visual Validation Block.
- Final Review Gate fails → reviewer names the smallest responsible block.
- Correction budget exhausted → stop writes, record failure, and present recovery options.
- Evidence missing → review returns `needs_changes`.

## Resume Protocol

When resuming a Figma task:

1. Run `planweave status --json`.
2. Run `planweave current --json`.
3. Read the active block prompt with `planweave prompt --json`.
4. If current refs are stale or inconsistent, use `plan-recovery`.
5. Before any write, live-revalidate target nodes, geometry, dependencies, components, and variables through `figma-cli`.
6. Submit new evidence to the active PlanWeave block or review gate.

PlanWeave evidence may record previous command output. It does not replace fresh Figma reads where live facts are required.

## `needs_changes` Routing

A review output with `needs_changes` must include:

```yaml
result: needs_changes
targetBlock: <block-id>
reason: <specific failure>
requiredChange: <observable correction>
```

The next action is to re-run or revise the named block. Agents must not continue into downstream blocks by acknowledging the issue in prose.

## Artifact State Boundary

- `.figma/screenshot/<planweave-ref>/` stores screenshot evidence for visual validation.
- `.figma/feedback/<timestamp>.md` stores self-reflection for future skill maintenance.
- Screenshot artifacts are not task state.
- Feedback artifacts are not task state.
- Deleting or retaining artifacts must not change PlanWeave completion state.
