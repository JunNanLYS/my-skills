# Validation, Final Review, and Delivery

Validation evidence feeds PlanWeave review gates. It never bypasses them.

## Structural Validation

Re-read in-scope nodes and verify:

- hierarchy, type, NodeId, and parent relation;
- position and size;
- Auto Layout, constraints, and sizing behavior;
- instances, variables, and style bindings;
- component or Component Set checks where applicable.

Structural failure routes to Correction Block.

## Geometry Validation

Run the geometry pipeline from `references/geometry-verifier.md` in order. Each failure routes to Correction Block and then reruns the affected gate.

## Visual Validation

Screenshots are saved under:

```text
.figma/screenshot/<planweave-ref>/
```

The agent must perform actual visual inspection by opening each final screenshot. Inspect text clipping, occlusion, alignment, spacing, color, state, radius, and layer order. Export success and exit code 0 do not prove visual correctness.

Visual failure routes to Correction Block and then reruns Visual Validation Block.

## Design-System Validation

Check current-task tokens, typography, spacing, grid, icons, components, states, and responsive behavior against `docs/FIGMA_DESIGN_SYSTEM.md`. In-scope direct dependencies must match the document. Out-of-scope historical differences are reported, not fixed.

## Correction Limit

Correction loop:

1. identify the specific node and failure;
2. apply the smallest correction;
3. rerun affected validation;
4. submit evidence to PlanWeave.

Automatic correction is capped at three rounds (`≤3`). After the third failed round, stop writes and submit recovery options.

## PlanWeave Final Review Gate

Final Review Gate checks:

- spec coverage;
- design-system alignment;
- executed PlanWeave block evidence;
- geometry evidence;
- visual evidence;
- out-of-scope integrity;
- screenshot artifact path;
- self-reflection readiness.

A failing final review returns `needs_changes` with the smallest responsible block.

## Delivery Block

Delivery reports:

- final scope completed;
- PlanWeave blocks and review gates passed;
- key `figma-cli` evidence;
- geometry evidence;
- visual screenshot paths;
- out-of-scope items;
- remaining risks or recovery options when the task did not pass.
