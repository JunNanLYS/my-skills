# `figma-skill` v1.2 Geometry & Placement Mandates — Implementation Plan

**Date:** 2026-07-13
**Skill target:** `figma-skill` 1.1 → 1.2
**Spec:** `docs/superpowers/specs/2026-07-13-figma-skill-geometry-and-placement-mandates.md`
**Execution order:** strictly linear. Each task must finish green before the next begins. Inline execution (no subagents), per user direction.

---

## Map: spec section → plan task

| Spec section                                  | Plan tasks                                    |
|-----------------------------------------------|-----------------------------------------------|
| 1 Background and Diagnosis                    | (read-only input, no task)                    |
| 2 Decision-Point Reflow Principle             | (no task, design constraint applied inline)   |
| 3 Visual-Overlap Rules                        | Task 1 (SKILL.md), Task 4 (referenced)        |
| 4 Three Families of Geometry Rules            | Task 1 (SKILL.md geometry mandates chapter)   |
| 5 Mandatory Lookups by Phase                  | Task 1 (SKILL.md), Task 2 (rule appended)     |
| 6 Workflows 0–11 Field-Change List            | Task 1 (SKILL.md)                             |
| 7 New `## Component Geometry Mandates`        | Task 1 (SKILL.md)                             |
| 8 Six New Red Flags                           | Task 1 (SKILL.md)                             |
| 9 Reference-File Edit List                    | Task 3 (execution.md), Task 4 (validation.md) |
| 10 Tests Changes                              | Task 5 (scenarios), Task 6 (validate-skill), Task 7 (naming-and-workflow) |
| 11 Completion Gate                            | Task 8 (final sync + push)                    |

---

## Task 1 — Rewrite `SKILL.md` for geometry mandates (v1.1 → v1.2)

**File**: `D:\ai-skills\figma-skill\SKILL.md`
**Frontmatter**: bump `version` 1.1 → 1.2. Keep `name`, `model`, `category`, `description` unchanged.
**Spec sections covered**: 3, 4, 5, 6, 7, 8.

### 1.1 Edit points (in document order)

1. **Bump frontmatter version**: `1.1` → `1.2` in the YAML block.

2. **Append to `## Non-Negotiable Rules`**: add the new mandatory lookup rule quoted in spec Section 5.2, placed immediately after the existing `eval/run` rule.

3. **Insert new chapter `## Mandatory Lookups by Phase`** between `## Approval Gates` and `## Workflows 0–11`. Use the exact five-row table from spec Section 5.1 plus the four forbidden lines.

4. **Inside `### Workflow 4A — Create Component`**: append sub-steps 6-9 from spec Section 6.1. Keep existing 1-5 unchanged.

5. **Inside `### Workflow 4D — Create Screen`**: append the 4-step overlap block (with user-explicit-overlap note) per spec Section 6.2.

6. **Inside `### Workflow 4F — Create Flow`**: append magnet-from-geometry rule per spec Section 6.3.

7. **Inside `### Workflow 6 — Figma Write Plan Approval`**: extend the fixed template to add `PlacementAudit`, `GeometryAudit`, `OverlapCheck`, `EvalRunFallback.GeometryReaudit` per spec Section 6.5.

8. **Inside `### Workflow 7 — Baseline Capture`**: extend to include the `Geometry:` block per spec Section 6.6.

9. **Inside `### Workflow 8 — Fixed-Order Execution`**: rewrite the per-batch check line to include geometry, Auto Layout mode, sizing strategy, bounding-box non-intersection per spec Section 6.7.

10. **Inside `### Workflow 9 — Fixed-Order Validation`**: rewrite the validation-order text to add Geometry between Structure and Visual per spec Section 6.8, and add a "Geometry-layer fixed actions" list.

11. **Inside `### Workflow 11 — Delivery`**: extend the delivery report template with `Geometry:`, `OverlapMatrix:`, `VariantRowParity:` per spec Section 6.9.

12. **Insert new chapter `## Component Geometry Mandates`** between `## Diagrams` and `## Reference Loading`. Use the verbatim content from spec Section 7.

13. **Append to `## Red Flags — Stop`**: add six new lines per spec Section 8 in the exact wording.

### 1.2 Verification before marking complete

- Run `node figma-skill/tests/validate-skill.mjs` → expect first-pass red on `assertNamingAndWorkflow` because new section keywords and red flags are not yet covered.
- That's expected; do NOT fix here. Just record the failure.

### 1.3 Output evidence

- Diff of `SKILL.md` showing all 13 edit points.
- `validate-skill.mjs` failure list (will be addressed in Task 6).

---

## Task 2 — Append new mandatory rule to `SKILL.md` Non-Negotiable Rules

**Merged into Task 1.1.2**. This task is collapsed into Task 1 because the rule is appended in the same place Non-Negotiable Rules already exists. No separate execution.

---

## Task 3 — Add `## Geometry-aware Commands` to `references/execution.md`

**File**: `D:\ai-skills\figma-skill\references\execution.md`
**Spec section**: 9.1

### 3.1 Action

Insert a new section directly before the existing `## Small-Batch Loop` heading. Use verbatim content from spec Section 9.1 (two bullet points plus the `duplicate|dup` warning).

### 3.2 Verification

- Read the file back, confirm the new heading sits before `## Small-Batch Loop` and the existing content remains unchanged.
- No test currently exercises `references/execution.md` content; manual read suffices.

---

## Task 4 — Add `## Geometry Validation Checklist` to `references/validation.md`

**File**: `D:\ai-skills\figma-skill\references\validation.md`
**Spec section**: 9.2

### 4.1 Action

Insert a new section directly before the existing `## Three Required Layers` heading. Use verbatim content from spec Section 9.2 (four bullet points).

### 4.2 Verification

- Manual read-back; confirm heading order: `## Bounds Audit` → `## Geometry Validation Checklist` (new) → `## Correction Limit` is the expected order. If spec says "before Three Required Layers", and current file has Bounds Audit / Correction Limit interspersed, place it at the very top of the validation-specific content (before Bounds Audit). If the existing order is Bounds Audit first, then place after Bounds Audit to maintain logical grouping. Apply whichever preserves current file conventions; document the placement decision.

---

## Task 5 — Add scenarios S11 / S12 / S13 + expected behavior rows

**Files**:
- `D:\ai-skills\figma-skill\tests\scenarios.md`
- `D:\ai-skills\figma-skill\tests\expected-behaviors.md`

**Spec section**: 10.1

### 5.1 Actions

1. Append three new scenarios to `scenarios.md` per spec Section 10.1 with full multi-choice questions (A / B / C). Match the writing style of existing S9 / S10.

2. Append three new rows to `expected-behaviors.md` table per spec Section 10.1 (S11 → B, S12 → B, S13 → B). Each row must include a concrete "Mandatory evidence in the answer" cell describing what the agent must show.

### 5.2 Verification

- Manual read-back; confirm total scenario count = 13 (S1–S13) and expected-behaviors table has 13 rows.
- Existing tests do not validate scenario count. Manual count suffices.

---

## Task 6 — Extend `tests/validate-skill.mjs` to assert new v1.2 markers

**File**: `D:\ai-skills\figma-skill\tests\validate-skill.mjs`
**Spec section**: 10.2

### 6.1 New asserts to add (inside `assertNamingAndWorkflow` or sibling)

1. `## Mandatory Lookups by Phase` heading present.
2. `## Component Geometry Mandates` heading present.
3. All six new Red Flags detectable by exact substring (each on its own line and not commented out):
   - `位置和上次差不多就行`
   - `这个组件不大，肯定不裁`
   - `变体形状应该一致`
   - `读完 spec 就能写，几何之后再说`
   - `引用文件太长，参考 SKILL.md 就行`
   - `父级默认就是 HUG，不用看`
4. Mandatory Lookups rule phrase present in `## Non-Negotiable Rules` section: the new rule's wording must appear before the next `##` heading.

### 6.2 Pre-existing pattern to mirror

The existing `assertNamingAndWorkflow` already iterates `must-contain` and `must-contain-regexphrases` lists. Reuse the same mechanism; if absent, add the lists and a single pass.

### 6.3 Verification

- Run `node figma-skill/tests/validate-skill.mjs` → expect PASS.
- The version bump should be reflected if there is a frontmatter version assert; if not, do not add one here (out of scope of this spec).

---

## Task 7 — Extend `tests/naming-and-workflow.test.mjs` with v1.2 cases

**File**: `D:\ai-skills\figma-skill\tests\naming-and-workflow.test.mjs`
**Spec section**: 10.3

### 7.1 New tests to add

1. **test 8**: SKILL.md includes all three visual-overlap placement phrases (spec Section 3):
   - `children` (in the read-before-write language)
   - `absoluteBoundingBox`
   - `0 相交` (or the rephrased `zero intersection` style must use one of: `0 相交`, `零相交`, `zero intersection`; spec uses `0 相交`, so use that exact string).
2. **test 9**: SKILL.md includes all three geometry-families keywords:
   - `textAutoResize`
   - `primaryAxisSizingMode`
   - `counterAxisSizingMode`
3. **test 10**: SKILL.md mentions Component Set variant parity (`primaryAxisSizingMode` for variant already covered by test 9; add a secondary check on `Component Set Variant Baseline` heading presence to anchor the chapter).

### 7.2 Verification

- Run `node --test figma-skill/tests/naming-and-workflow.test.mjs` → expect 10/10 PASS.

---

## Task 8 — Final sync, traceability update, regression sweep, push

**Files**:
- `D:\ai-skills\figma-skill\tests\naming-results.md` (update for v1.2)
- Run all deterministic tests.
- Commit and push.

**Spec section**: 11 (Completion Gate).

### 8.1 Traceability update

Open `naming-results.md` and add a v1.2 section at the end (or top) with:
- File edited: `SKILL.md`
- Section headings added: `## Mandatory Lookups by Phase`, `## Component Geometry Mandates`
- Spec mapping table: spec Sections 3 → SKILL.md lines (capture after edits), 4 → chapter, 5 → chapter, 6 → workflow field changes, 7 → new chapter, 8 → new red flags, 10.2/10.3 → test extensions.

If exact line numbers cannot be captured at write time, leave placeholders `TBD` and resolve after final SKILL.md write.

### 8.2 Regression sweep (run in order, expect all green)

1. `node figma-skill/tests/validate-skill.mjs` — must PASS
2. `node --test figma-skill/tests/naming-and-workflow.test.mjs` — must report 10/10 PASS
3. `node --test figma-skill/tests/figma-validate-bounds.test.mjs` — must remain PASS (regression guard)
4. `git status` — confirm no uncommitted surprises

### 8.3 Commit and push

1. `git add -A`
2. `git commit -m "feat(figma-skill): upgrade to v1.2 with geometry and placement mandates"`
3. `git push origin main` — if TLS error recurs, fall back to GitHub Git Data API per v1.1 known issue.

### 8.4 Sync to runtime dirs (project hook)

The repository hook `.claude/settings.json` will run `node sync-skills.mjs --only-changed -v` automatically after a successful push. No manual action.

---

## Risk and Regression Points

| Risk                                                                  | Mitigation                                                              |
|------------------------------------------------------------------------|--------------------------------------------------------------------------|
| SKILL.md grows past 750 lines → exceeds comfortable read budget       | Spec is already designed to land near 700 lines; if exceeded, simplify wording in spec Section 7 without losing any rule. |
| Tests ordering breaks because new asserts added before SKILL.md update | Task 1 records red failure → Task 6 turns it green. Linear order required. |
| references/validation.md placement ambiguous                          | Task 4 documents placement decision; pick conservative option (right after `## Bounds Audit` if Bounds Audit is currently first under validation specifics). |
| Git push TLS error (known v1.1 issue)                                 | Same GitHub Git Data API fallback that v1.1 used.                       |
| Geometry chapter misnamed                                             | Must be exactly `## Component Geometry Mandates` to match spec and validator assertions. |
| Spec sub-step numbers (4A: 6-9) collide with existing numbering        | Spec uses 6-9 because steps 1-5 already exist; SKILL.md must keep current step numbering and append new steps with explicit new numbers; verify no count collision. |

---

## Definition of Done

This plan is complete when ALL of the following are true:

1. SKILL.md frontmatter reads `version: 1.2`.
2. SKILL.md contains `## Mandatory Lookups by Phase` with all five workflow-to-reference rows.
3. SKILL.md contains `## Component Geometry Mandates` with all four sub-headings from spec Section 7.
4. SKILL.md `## Red Flags — Stop` contains the six new flags, in order, by exact substring.
5. SKILL.md Workflows 4A, 4D, 4F, 6, 7, 8, 9, 11 each show the spec Section 6 additions explicitly.
6. `references/execution.md` has the new `## Geometry-aware Commands` section before `## Small-Batch Loop`.
7. `references/validation.md` has the new `## Geometry Validation Checklist` section in the position chosen by Task 4.2.
8. `tests/scenarios.md` has scenarios S11, S12, S13 with full multi-choice text.
9. `tests/expected-behaviors.md` table has rows for S11, S12, S13.
10. `tests/validate-skill.mjs` PASS.
11. `tests/naming-and-workflow.test.mjs` reports 10/10 PASS.
12. `tests/figma-validate-bounds.test.mjs` still PASS.
13. `tests/naming-results.md` updated with v1.2 traceability rows.
14. `git push` succeeds (or fall back to GitHub API).
15. Project hook runs sync-skills on push completion; runtime dirs `~/.claude/skills/figma-skill` and `~/.codex/skills/figma-skill` reflect v1.2.

If any item fails, Task 8 is not complete, and the next attempt begins at Task 1 (re-verify current SKILL.md state vs spec).

---

## Single-Executor Feasibility

All tasks are inline:

- No subagent dispatches.
- No parallel file edits.
- Each task has a single concrete action (Edit / Write / Bash run).
- Each task has a single verification step.
- The longest single tool call is the SKILL.md rewrite in Task 1; that is a multi-point Edit pass, not a subagent dispatch.

Total file touches: 5 (SKILL.md, execution.md, validation.md, scenarios.md, expected-behaviors.md, validate-skill.mjs, naming-and-workflow.test.mjs, naming-results.md = 8 actually). All under the workspace root.
