---
name: figma-skill-planweave-v3-design
model: sonnet
category: design
description: Design for converting figma-skill from its v2 .figma task ledger to a PlanWeave-authoritative v3 spec-plan-execute workflow.
version: 1.0
---

# `figma-skill` v3.0 — PlanWeave-Authoritative Spec → Plan → Execute Workflow

**Date:** 2026-07-16
**Status:** Pending user review
**Target version:** `figma-skill` 3.0
**Depends on:** `figma-skill` 2.2, local PlanWeave CLI and skills
**Source:** User direction in this session: hard-depend on PlanWeave, remove the old `.figma/tasks` ledger, retain `.figma/screenshot` and `.figma/feedback` as Figma artifact channels.

## 1. Decision Summary

Version 3.0 replaces the v2 `.figma/tasks` task ledger with PlanWeave as the authority for task lifecycle, requirements, spec, plan, execution blocks, review gates, failure routing, and recovery.

The core split is:

1. **PlanWeave is the workflow authority.** It owns requirements discovery, spec approval, implementation plan approval, task/block graph dependencies, runner prompts, reviewer prompts, `pass` / `needs_changes`, rework routing, completion, and recovery.
2. **`figma-cli` is the Figma fact and mutation authority.** All live reads, writes, exports, geometry evidence, screenshot generation, and Figma validation still go through `figma-cli`. Figma MCP, GUI automation, direct REST calls, and memory-derived assumptions remain forbidden as substitutes.
3. **`.figma/` is no longer a task ledger.** Keep only:
   - `.figma/screenshot/<planweave-ref>/` for Figma visual validation artifacts;
   - `.figma/feedback/<timestamp>.md` for cross-session figma-skill self-reflection.

This is a hard cut, not a compatibility shim. The old v2 ledger concepts (`state.json`, `events.jsonl`, `plan.md`, `todo.md`, `recovery.md`, lease, checkpoint, archiveStatus) should be removed from the authoritative workflow.

## 2. Goals

1. Make PlanWeave the single source of truth for Figma task state, planning, execution, review, failure routing, and recovery.
2. Enforce a Superpowers-style order for Figma tasks: understand requirements and facts first, write spec, review spec, write plan, review plan, then execute.
3. Require `docs/FIGMA_DESIGN_SYSTEM.md` and relevant live Figma context **before** drafting the spec, not as a later plan step.
4. Define a Figma-specific PlanWeave package shape: spec canvas, implementation canvas, required blocks, fixed final validation steps, and structured review-gate outputs.
5. Delete the old `.figma/tasks` ledger implementation and tests instead of maintaining a second task state machine.
6. Preserve high-value Figma invariants from v2: figma-cli-only operation, design-system authority, naming rules, eval/run gate, geometry validation, visual screenshot validation, and self-reflection.

## 3. Non-Goals

1. No migration of historical `.figma/tasks/<task-id>/` records. Existing records may remain on disk if already ignored, but v3 documentation and tests should not treat them as active workflow state.
2. No replacement of `figma-cli` with PlanWeave. PlanWeave orchestrates; `figma-cli` reads and mutates Figma.
3. No soft migration where old scripts remain authoritative. If a helper only exists to maintain the old task ledger, it should be deleted or removed from the skill contract.
4. No automatic creation of PlanWeave packages in this design document. Implementation should define the package shape and tests first, then update docs and code.
5. No weakening of Figma validation. Geometry and visual gates remain mandatory for write tasks.

## 4. Authority Boundaries

### 4.1 PlanWeave Authority

PlanWeave owns:

- requirements discovery state;
- spec production and review;
- implementation plan production and review;
- project graph / canvas graph / task graph / block dependencies;
- runner and reviewer prompts;
- review outputs (`pass` / `needs_changes`);
- rework routing to the smallest responsible block;
- recovery after failures, stale context, or interrupted execution;
- final completion state.

`figma-skill` should route complex or real Figma work through PlanWeave, not through a local `.figma/tasks` state machine.

### 4.2 `figma-cli` Authority

`figma-cli` remains the only authorized path for:

- environment status and connection checks;
- current Figma file and page discovery;
- live node, geometry, component, style, and variable reads;
- all Figma writes;
- exports and screenshots;
- validation data collection;
- helper-script execution through approved `figma-cli run` paths.

PlanWeave evidence may record command results, but it does not replace fresh Figma reads where the skill requires live context.

### 4.3 `.figma/` Artifact Boundary

`.figma/` retains only artifact duties:

```text
.figma/
  screenshot/<planweave-ref>/   # visual validation artifacts only
  feedback/<timestamp>.md       # skill self-reflection only
```

`.figma/` must not contain the authoritative task plan, todo list, state machine, lease, checkpoint ledger, or recovery source of truth.

## 5. New Lifecycle

The v3 lifecycle is:

```text
User request
  → Requirements discovery
  → Pre-Spec Context Gate
  → PlanWeave Spec Canvas
  → Spec Review Gate
  → PlanWeave Implementation Canvas
  → Plan Review Gate
  → Pre-write Live Revalidation Block
  → Figma Write Blocks
  → Geometry Validation Blocks
  → Correction Blocks as needed
  → Visual Validation Block
  → Final Review Gate
  → Delivery Block
  → Self-Reflection Block
```

State routing rules:

- Requirements unclear → stay in requirements discovery and ask targeted questions.
- Pre-Spec Context Gate incomplete → no spec, no plan, no Figma write.
- Spec review `needs_changes` → return to the named context/spec block.
- Plan review `needs_changes` → return to Plan Draft Block.
- Pre-write live revalidation conflicts with approved plan → return to Plan Draft or Spec Draft, depending on the source of drift.
- Geometry or visual validation fails → enter Correction Block and rerun affected validation.
- Final review `needs_changes` → reviewer must name the smallest responsible block.
- Correction budget exhausted → stop writes and deliver failure/recovery options through PlanWeave.

## 6. Pre-Spec Context Gate

The Pre-Spec Context Gate is mandatory before any spec is drafted. It is not an implementation-plan step.

### 6.1 User Requirements

Before spec drafting, the agent must identify:

- user goal;
- non-goals and out-of-scope boundaries;
- task type: `Create | Modify | Audit | Migrate | Export`;
- whether Figma write access is required;
- unknowns that require user clarification.

If any blocking requirement is unclear, the agent must ask before writing the spec.

### 6.2 Design System Context

Before spec drafting, the agent must read `docs/FIGMA_DESIGN_SYSTEM.md`.

The spec must cite relevant design-system rules. If the document is missing or lacks rules needed for the current task, the agent must:

1. draft the minimum design-system addition needed for this task;
2. explain basis, impact, and out-of-scope conflicts;
3. obtain explicit user approval;
4. update the design-system document if approved;
5. only then continue to the main task spec.

Design-system approval does not authorize Figma writes.

### 6.3 Figma Environment Facts

For tasks requiring live Figma reads or writes, the current session must complete the environment gate before spec drafting:

```bash
figma-cli --version
figma-cli --help
figma-cli status
# only if disconnected:
figma-cli connect
figma-cli status
```

This gate remains a Figma fact gate, not a PlanWeave substitute.

### 6.4 Live Figma Context

Before spec drafting:

- `Modify`, `Audit`, `Migrate`, and `Export` tasks must live-read the target file/page/section/frame, direct children, key geometry, relevant components, variables, styles, and dependencies.
- `Create` tasks must live-read the target file structure, the three-page architecture, target mount location, reusable components, and reusable variables/styles.
- When visual baseline matters, screenshots should be exported to `.figma/screenshot/<planweave-ref>/` before spec drafting.

The spec must reference the gathered live evidence. Historical memory, previous plan text, or old screenshot paths cannot substitute for required live reads.

## 7. Spec Gate

The spec describes what must be true when the task is complete. It does not describe the command sequence.

A Figma spec must include:

- requirements summary;
- task classification and write/read-only status;
- design-system basis;
- current live Figma facts;
- target Figma state;
- affected pages, sections, frames, components, variants, variables, styles, and names;
- naming grammar decisions;
- geometry and visual acceptance criteria;
- explicit out-of-scope list;
- assumptions approved by the user;
- unresolved questions, if any.

A Figma spec must not include:

- detailed command sequence;
- write batch order;
- `eval/run` implementation code;
- correction-loop details;
- runner/reviewer assignment details.

The Spec Review Gate must return either:

```yaml
result: pass
```

or:

```yaml
result: needs_changes
targetBlock: <requirements|design-system-context|figma-live-context|spec-draft block id>
reason: <specific failure>
requiredChange: <observable correction>
```

A non-passing spec blocks implementation planning.

## 8. PlanWeave Package Shape

### 8.1 Minimum Package Shape

A simple Figma task should use one PlanWeave project with two canvases:

```text
Project: figma-<task-slug>

Canvas A: spec
  Purpose: requirements, design-system context, live Figma context, spec draft, spec review

Canvas B: implementation
  Purpose: approved spec → implementation plan → execution → validation → review → delivery

Project graph:
  spec -> implementation
```

Complex tasks may add canvases, but the project graph must still represent the required order. Mandatory ordering must not exist only in prose or block prompts.

### 8.2 Required Spec Canvas Blocks

Every Figma Spec Canvas must include:

1. **Requirements Discovery Block**
   - Objective: clarify goal, non-goals, task type, and write requirement.
   - Done criteria: task classification and blocking questions resolved.

2. **Design System Context Block**
   - Objective: read `docs/FIGMA_DESIGN_SYSTEM.md` and extract relevant rules.
   - Done criteria: spec can cite concrete design-system rules, or a user-approved design-system addition exists.

3. **Figma Live Context Block**
   - Objective: gather required current Figma evidence via `figma-cli`.
   - Done criteria: spec has live evidence for target structure, geometry, reusable assets, and visual baseline as needed.

4. **Spec Draft Block**
   - Objective: write the task spec.
   - Done criteria: spec covers target state, boundaries, acceptance, and out-of-scope without command sequencing.

5. **Spec Review Gate**
   - Objective: verify spec readiness.
   - Done criteria: `pass`, or `needs_changes` with target block and observable correction.

### 8.3 Required Implementation Canvas Blocks

Every write-capable Figma Implementation Canvas must include:

1. **Plan Draft Block**
   - Input: approved spec.
   - Output: executable PlanWeave graph with write sequence, dependencies, validation, and review gates.

2. **Plan Review Gate**
   - Checks spec coverage, block verifiability, dependency correctness, final validation blocks, and failure routing.
   - `needs_changes` returns to Plan Draft Block.

3. **Pre-write Live Revalidation Block**
   - Re-read target nodes, geometry, dependencies, components, and variables immediately before writes.
   - Drift or conflict returns to Plan Draft or Spec Draft.

4. **Figma Write Blocks**
   - Each block owns one coherent, verifiable mutation group.
   - Only `figma-cli` writes are allowed.
   - Shared components/variables require their own block and review when risky.
   - `eval/run` requires the six-field fallback chain and explicit approval.

5. **Geometry Validation Block**
   - Runs required geometry checks in the documented order.
   - Failure routes to Correction Block.

6. **Correction Block**
   - Applies the smallest correction needed.
   - Reruns affected validation.
   - Stops and reports failure when the correction budget is exhausted.

7. **Visual Validation Block**
   - Exports screenshots to `.figma/screenshot/<planweave-ref>/`.
   - Requires actual visual inspection.
   - Visual failure routes to Correction Block.

8. **Final Review Gate**
   - Checks spec coverage, executed plan, geometry evidence, visual evidence, out-of-scope integrity, and artifact handling.
   - `needs_changes` must target the smallest responsible block.

9. **Delivery Block**
   - Reports final scope, evidence, artifact paths, and out-of-scope items.

10. **Self-Reflection Block**
    - Writes `.figma/feedback/<timestamp>.md` with observed issues and improvement proposals.

For read-only `Audit` and `Export` tasks, Figma Write Blocks and Correction Blocks that mutate Figma are forbidden unless the user starts a new write-capable task.

## 9. Fixed Final Blocks as Plan Lint

A Figma implementation plan must fail Plan Review if it omits any required final block for its task type.

For write-capable tasks, required final blocks are:

- Pre-write Live Revalidation;
- Figma Write Execution;
- Geometry Validation;
- Correction Loop;
- Visual Validation;
- Final Review Gate;
- Delivery;
- Self-Reflection;
- `.figma/screenshot` artifact handling;
- `.figma/feedback` artifact handling.

The plan must also describe the rework route for each validation/review failure. A plan that only says "fix issues" or "continue polishing" is not reviewable.

## 10. Standard Review-Gate Contract

Every Figma PlanWeave review gate should use this output shape:

```yaml
result: pass | needs_changes
checked:
  - spec_coverage
  - design_system_alignment
  - figma_live_evidence
  - dependency_order
  - validation_evidence
  - visual_evidence
  - out_of_scope_integrity
if_needs_changes:
  targetBlock: <block-id>
  reason: <specific failure>
  requiredChange: <observable correction>
```

Rules:

- `needs_changes` must identify the target block.
- `needs_changes` must state an observable correction.
- A reviewer must not pass with known geometry, visual, evidence, or scope failures.
- Agents must not bypass review gates by self-acknowledging issues and continuing.

## 11. Reference Refactor Plan

### 11.1 `SKILL.md`

Update to v3.0 and rewrite as the compact router for:

- PlanWeave authority;
- figma-cli authority;
- retained `.figma/screenshot` and `.figma/feedback` artifacts;
- Pre-Spec Context Gate;
- Spec Gate;
- Plan Gate;
- Execution;
- Validation;
- Final Review;
- Self-Reflection;
- Red Flags for attempting to use the old ledger or delaying design-system reads until the plan.

Remove old v2 sections:

- `.figma/tasks` Task Entry Pattern;
- Workflow I/O Gate Contract;
- v2 State Machine Summary;
- archiveStatus-based completion contract;
- task-state checkpoint requirements.

### 11.2 `references/planning.md`

Rewrite as the primary v3 planning authority:

- Pre-Spec Context Gate;
- Spec Canvas and required blocks;
- Implementation Canvas and required blocks;
- PlanWeave graph-dependency rules;
- review-gate output format;
- fixed final block lint;
- rework routing.

Delete old material about `.figma/tasks`, `plan.md`, `todo.md`, `events.jsonl`, `figma-task-state.mjs checkpoint`, old `GateStatus`, and old ledger plan versioning.

### 11.3 `references/state-and-recovery.md`

Rewrite around PlanWeave:

- use `planweave status`, `current`, claim, prompt, submit, review, and recovery outputs as state authority;
- no local `.figma/tasks` state machine;
- resume by inspecting PlanWeave state and then live-revalidating Figma before writes;
- `needs_changes` routes back to the target block;
- screenshot artifacts do not decide task state.

### 11.4 `references/execution.md`

Keep figma-cli execution rules, but remove old task-state helper exemptions:

- no `figma-task-state.mjs` offline state helper;
- PlanWeave runner blocks authorize execution scope;
- each write block returns evidence to PlanWeave results/reviews;
- eval/run six-field fallback remains mandatory.

### 11.5 `references/validation.md`

Refactor final validation into PlanWeave terms:

- geometry and visual evidence feed PlanWeave review;
- screenshots remain under `.figma/screenshot/<planweave-ref>/`;
- final review failure routes to correction;
- self-reflection follows PlanWeave completion.

### 11.6 `references/design-system.md`

Add an explicit Pre-Spec rule:

- `docs/FIGMA_DESIGN_SYSTEM.md` must be read before spec drafting;
- missing rules require a user-approved design-system addition before main spec;
- design-system approval does not authorize Figma writes.

### 11.7 `references/geometry-verifier.md`, `references/naming.md`, `references/installation.md`

Preserve core rules and replace only old workflow/ledger references.

### 11.8 `references/self-reflection.md`

Retain `.figma/feedback` but describe it as a PlanWeave Self-Reflection Block artifact, not a v2 Workflow 12 ledger step.

## 12. Deletion Scope

Delete old ledger implementation:

- `figma-skill/scripts/figma-task-state.mjs`;
- `figma-skill/scripts/lib/task-state/**`;
- `figma-skill/schemas/task-state.schema.json`;
- `figma-skill/schemas/event.schema.json`;
- `figma-skill/schemas/index.schema.json`.

Delete or rewrite tests that only validate the old ledger:

- `figma-skill/tests/task-state-*.test.mjs`;
- `workflow-contract.test.mjs` sections importing `TRANSITIONS`, `EVENT_TYPES`, `WRITE_REQUIRED_WORKFLOWS`, or old task statuses;
- `plan-clipwhitelist.test.mjs` if it depends only on old `assertValidPlan` from the task-state validator.

Keep or migrate:

- figma read/write helper tests;
- install tests;
- naming tests;
- geometry validation tests;
- containment and idempotency tests not tied to old ledger state;
- self-reflection tests, rewritten around PlanWeave triggering.

## 13. Test Strategy

Implementation must follow documentation TDD for skill changes: write failing tests first, watch them fail, then update docs/code.

### 13.1 Contract Tests

Add or update tests to assert:

- `SKILL.md` frontmatter version is `3.0`;
- PlanWeave is named as workflow authority;
- `figma-cli` remains Figma fact/write authority;
- `.figma/screenshot` and `.figma/feedback` remain;
- `.figma/tasks`, `events.jsonl`, `lease`, `archiveStatus`, and `figma-task-state.mjs` are absent from authoritative runtime docs;
- Figma MCP remains forbidden as a substitute;
- `docs/FIGMA_DESIGN_SYSTEM.md` is required before spec drafting.

### 13.2 PlanWeave Plan-Spec Tests

Assert `references/planning.md` contains:

- Pre-Spec Context Gate;
- Spec Canvas;
- Implementation Canvas;
- Spec Review Gate;
- Plan Review Gate;
- required final blocks;
- structured `needs_changes` output;
- explicit statement that design-system reading is pre-spec evidence, not a plan step.

### 13.3 Negative Wording Tests

Assert runtime docs do not permit:

- writing a plan before reading `FIGMA_DESIGN_SYSTEM.md`;
- treating `Step 1: read FIGMA_DESIGN_SYSTEM.md` inside implementation plan as the first design-system read;
- using `.figma/tasks` as state authority;
- checkpointing `state.json`;
- relying on old `plan.md` / `todo.md` ledger files;
- bypassing PlanWeave review gates after `needs_changes`.

### 13.4 Preservation Tests

Keep regression coverage for:

- figma-cli-only operation;
- current help lookup;
- eval/run six-field fallback;
- three-page architecture;
- naming grammar;
- geometry validation;
- visual screenshot validation;
- self-reflection feedback file shape.

## 14. Failure and Recovery Semantics

Failure handling belongs to PlanWeave:

- Spec review fails → return to the named spec/context block.
- Plan review fails → return to Plan Draft Block.
- Pre-write live revalidation finds drift → return to Plan Draft or Spec Draft.
- Write block fails → block reports failure and evidence; PlanWeave routes retry/correction/recovery.
- Geometry validation fails → Correction Block, then rerun affected validation.
- Visual validation fails → Correction Block, then rerun screenshot and visual review.
- Final review fails → reviewer names the smallest responsible block.
- Correction budget exhausted → stop writes, record failure, and present recovery options.
- Evidence missing → review must return `needs_changes`.

## 15. Acceptance Criteria

The v3 migration is complete when:

1. Runtime docs describe PlanWeave as the only workflow/task authority.
2. Runtime docs no longer describe `.figma/tasks` as an active ledger.
3. The old task-state implementation and ledger-only tests are removed or rewritten.
4. `docs/FIGMA_DESIGN_SYSTEM.md` is mandated before spec drafting.
5. Planning docs define the Spec Canvas, Implementation Canvas, fixed final blocks, and review-gate output contract.
6. Tests fail before the migration and pass after it.
7. Existing figma-cli, naming, geometry, visual validation, screenshot, and feedback invariants remain covered.
8. `figma-skill` version is bumped to `3.0`.
9. The repository is committed and pushed to `origin main` after implementation.

## 16. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| PlanWeave terminology makes `figma-skill` harder to read | Keep `SKILL.md` compact; move package/block details into `references/planning.md`. |
| Agents delay `FIGMA_DESIGN_SYSTEM.md` reading until plan execution | Add explicit Pre-Spec gate and negative tests. |
| Old `.figma/tasks` wording survives in references | Add grep-like contract tests over runtime markdown. |
| Removal of task-state code breaks unrelated helper tests | Delete only ledger-specific code; preserve geometry/read/write helpers. |
| Review gates become prose-only | Require structured `pass` / `needs_changes` format and graph dependencies. |
| Screenshot artifacts become mistaken for state | State clearly that `.figma/screenshot` is evidence only and PlanWeave owns task state. |

## 17. Open Questions for Implementation Planning

1. Whether to add a small PlanWeave-specific reference file, e.g. `references/planweave-workflow.md`, or keep all PlanWeave plan rules in `references/planning.md`.
2. Whether screenshot artifact directories should use the PlanWeave block id, task id, or a stable package slug in `<planweave-ref>`.
3. Which existing tests should be rewritten versus deleted after the new v3 contract tests are in place.
4. Whether to retain `schemas/config.schema.json` if it still describes non-ledger skill configuration, or delete it if it only served the old `.figma` ledger.
