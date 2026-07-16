# PlanWeave Planning and Approval Gates

`planning.md` is the primary authority for the figma-skill v3 requirements → spec → plan → execute order. PlanWeave owns workflow state; figma-cli owns Figma facts and mutations.

## Pre-Spec Context Gate

The Pre-Spec Context Gate is mandatory before spec drafting. It is not an implementation-plan step.

### User Requirements

Before spec drafting, identify:

- user goal;
- non-goals and out-of-scope boundaries;
- task type: `Create | Modify | Audit | Migrate | Export`;
- whether Figma write access is required;
- blocking unknowns that require user clarification.

If a blocking requirement is unclear, ask targeted questions before writing the spec.

### Design System Context

Before spec drafting, read `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md`. The spec must cite relevant rules from that document.

If the document is missing or lacks rules needed for the current task:

1. draft the minimum design-system addition needed for the task;
2. explain basis, impact, and out-of-scope conflicts;
3. obtain explicit user approval;
4. update the design-system document only after approval;
5. continue to the main task spec only after the design-system gap is closed.

Design-system approval does not authorize Figma writes.

### Figma Environment Facts

For tasks requiring live Figma reads or writes, run the environment gate before spec drafting:

```bash
figma-cli --version
figma-cli --help
figma-cli status
# only if disconnected:
figma-cli connect
figma-cli status
```

Environment output is evidence for the spec. It does not replace PlanWeave state.

### Live Figma Context

Before spec drafting:

- `Modify`, `Audit`, `Migrate`, and `Export` tasks must live-read the target file/page/section/frame, direct children, key geometry, relevant components, variables, styles, and dependencies.
- `Create` tasks must live-read the target file structure, the three-page architecture, target mount location, reusable components, and reusable variables/styles.
- When visual baseline matters, export screenshots to `.figma/screenshot/<planweave-ref>/` before spec drafting.

Historical memory, previous plan text, or old screenshots cannot substitute for required live reads.

## Spec Canvas

A simple Figma task uses one PlanWeave project with a `spec` canvas and an `implementation` canvas. Complex tasks may add canvases, but required ordering must be encoded in the PlanWeave graph.

Every Figma Spec Canvas must include these blocks:

1. **Requirements Discovery Block**
   - Objective: clarify goal, non-goals, task type, write requirement, and blocking questions.
   - Done criteria: classification and blocking questions are resolved.
2. **Design System Context Block**
   - Objective: read `docs/FIGMA_DESIGN_SYSTEM.md` and extract applicable rules.
   - Done criteria: spec can cite concrete rules, or a user-approved design-system addition exists.
3. **Figma Live Context Block**
   - Objective: gather current Figma evidence through `figma-cli`.
   - Done criteria: spec has evidence for target structure, geometry, reusable assets, and visual baseline as needed.
4. **Spec Draft Block**
   - Objective: write the task spec.
   - Done criteria: spec covers target truth, boundaries, acceptance, and out-of-scope without command sequencing.
5. **Spec Review Gate**
   - Objective: verify spec readiness.
   - Done criteria: `pass`, or `needs_changes` with target block and observable correction.

## Spec Gate

The spec describes what must be true when the task is complete. It must include:

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
- unresolved questions if any remain.

The spec must not include:

- detailed command sequence;
- write batch order;
- `eval/run` implementation code;
- correction-loop details;
- runner or reviewer assignment details.

A non-passing Spec Review Gate blocks implementation planning.

## Implementation Canvas

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
   - Shared components or variables require their own block and review when risky.
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
   - `needs_changes` targets the smallest responsible block.
9. **Delivery Block**
   - Reports final scope, evidence, artifact paths, and out-of-scope items.
10. **Self-Reflection Block**
    - Writes `.figma/feedback/<timestamp>.md` with observed issues and improvement proposals.

For read-only `Audit` and `Export` tasks, Figma Write Blocks and mutation Correction Blocks are forbidden unless the user starts a new write-capable task.

## Fixed Final Blocks as Plan Lint

A write-capable implementation plan fails Plan Review if it omits any of these final blocks:

- Pre-write Live Revalidation;
- Figma Write Execution;
- Geometry Validation;
- Correction Loop;
- Visual Validation;
- Final Review Gate;
- Delivery;
- Self-Reflection;
- `.figma/screenshot/<planweave-ref>/` artifact handling;
- `.figma/feedback/<timestamp>.md` artifact handling.

The plan must describe the rework route for each validation or review failure. A plan that only says "fix issues" or "polish" is not reviewable.

## Review Gate Contract

Every Figma PlanWeave review gate returns this shape:

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
- Reviewers must not pass with known geometry, visual, evidence, or scope failures.
- Agents must not bypass review gates by self-acknowledging issues and continuing.

## Reuse Decision

Use the first applicable path:

1. Existing component or reuse handle exists → spec the reuse, then instantiate.
2. Cross-page, multi-state, or jointly evolving element → create or update a Component or Component Set.
3. Same-page structure is identical but content differs → complete one item, duplicate, re-read NodeIds, then modify each copy.
4. Multiple identical independent nodes → use a render-batch path approved in the plan.
5. Only create new primitives after confirming no reusable structure exists.

User requests for N similar objects require N distinct nodes. A wrapper may not masquerade as multiple requested objects.

## Failure and Rework Routing

- Requirements unclear → Requirements Discovery Block.
- Missing design-system basis → Design System Context Block.
- Missing live evidence → Figma Live Context Block.
- Spec mismatch → Spec Draft Block.
- Plan lacks dependency order or final blocks → Plan Draft Block.
- Pre-write drift → Plan Draft Block or Spec Draft Block depending on drift source.
- Write failure → responsible Figma Write Block.
- Geometry failure → Correction Block, then Geometry Validation Block.
- Visual failure → Correction Block, then Visual Validation Block.
- Final review failure → smallest responsible block named by reviewer.
- Correction budget exhausted → stop writes and present recovery options.
