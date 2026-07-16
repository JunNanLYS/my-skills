# figma-skill PlanWeave v3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `figma-skill` from its v2 `.figma/tasks` ledger workflow to a v3 PlanWeave-authoritative spec → plan → execute workflow while preserving figma-cli-only Figma operation, geometry validation, visual validation, screenshot artifacts, and feedback artifacts.

**Architecture:** This migration is a hard cut. PlanWeave becomes the only workflow/task authority; `figma-cli` remains the only Figma fact and mutation authority; `.figma/` keeps only `screenshot/<planweave-ref>/` and `feedback/<timestamp>.md`. The implementation is documentation-first with contract tests: each runtime reference is rewritten around the v3 lifecycle, then old task-state code, schemas, and ledger-only tests are deleted.

**Tech Stack:** Markdown skill runtime files, Node.js ESM tests (`node:test`), PowerShell installer tests, `figma-cli`, PlanWeave CLI and skills, repository-local scripts under `figma-skill/scripts/`.

## Global Constraints

- **Target version:** `figma-skill` `3.0`.
- **Workflow authority:** PlanWeave owns requirements discovery, spec approval, plan approval, block dependencies, runner/reviewer prompts, `pass` / `needs_changes`, rework routing, completion, and recovery.
- **Figma authority:** `figma-cli` owns environment status, live Figma reads, writes, exports, screenshots, geometry evidence, and validation data.
- **Artifact boundary:** `.figma/` retains only `.figma/screenshot/<planweave-ref>/` and `.figma/feedback/<timestamp>.md`.
- **Deleted authority:** `.figma/tasks`, `state.json`, `events.jsonl`, `plan.md`, `todo.md`, `recovery.md`, lease, checkpoint, and `archiveStatus` must not remain active workflow state.
- **Pre-Spec Context Gate:** `docs/FIGMA_DESIGN_SYSTEM.md`, figma-cli environment facts, and relevant live Figma context must be gathered before spec drafting.
- **Spec Gate:** spec describes required final truth and must not include command sequencing, write order, eval/run code, correction loop details, or runner/reviewer assignments.
- **Plan Gate:** implementation plans must include required PlanWeave blocks, dependencies, validation blocks, and failure routes.
- **Review contract:** every review gate returns `result: pass` or `result: needs_changes` with `targetBlock`, `reason`, and `requiredChange`.
- **Validation:** write-capable tasks require pre-write live revalidation, Figma write blocks, geometry validation, correction loop, visual validation, final review, delivery, and self-reflection.
- **Correction budget:** automatic correction remains capped at three rounds (`≤3`).
- **Figma path ban:** Figma MCP, GUI automation, direct Figma REST calls, and memory-derived assumptions remain forbidden as substitutes for `figma-cli`.
- **Versioning rule:** modifying `SKILL.md` or any reference file requires updating `SKILL.md` frontmatter version before commit.
- **Commit cadence:** each implementation task ends with a conventional commit. After the final task, push to `origin main`; the repository hook syncs changed skills.

---

## File Structure

### Files to modify

- `figma-skill/SKILL.md` — compact v3 router: PlanWeave authority, figma-cli authority, artifact boundary, lifecycle, required lookups, review contract, red flags, version `3.0`.
- `figma-skill/references/planning.md` — primary v3 PlanWeave planning authority: Pre-Spec Context Gate, Spec Canvas, Implementation Canvas, required blocks, review-gate contract, fixed final block lint, rework routing.
- `figma-skill/references/state-and-recovery.md` — PlanWeave state and recovery authority: use PlanWeave CLI outputs and recovery skills; no local ledger.
- `figma-skill/references/execution.md` — figma-cli execution authority: command truth, pre-write live revalidation, small-batch execution, `eval/run` six-field fallback, write evidence submission to PlanWeave.
- `figma-skill/references/validation.md` — PlanWeave validation and delivery authority: geometry evidence, screenshot artifacts, visual inspection, final review, delivery, failure routing.
- `figma-skill/references/design-system.md` — explicit Pre-Spec rule for `docs/FIGMA_DESIGN_SYSTEM.md` and the design-system approval boundary.
- `figma-skill/references/geometry-verifier.md` — preserve seven gates; replace old workflow/ledger references with PlanWeave block names and `.figma/screenshot/<planweave-ref>/`.
- `figma-skill/references/naming.md` — preserve naming grammar; replace v2 workflow references with v3 lookup language.
- `figma-skill/references/installation.md` — preserve environment order; describe it as Pre-Spec Context Gate evidence.
- `figma-skill/references/self-reflection.md` — retain `.figma/feedback` but describe it as PlanWeave Self-Reflection Block output.
- `figma-skill/scripts/README.md` — remove task-state CLI material; keep helper script descriptions for figma-cli-run helpers.
- `figma-skill/tests/validate-skill.mjs` — rewrite structural validation for v3 files and v3 invariants.
- `figma-skill/tests/workflow-contract.test.mjs` — replace v2 state-machine assertions with v3 PlanWeave contract assertions.
- `figma-skill/tests/naming-and-workflow.test.mjs` — update workflow assertions from v2 Workflow IDs to v3 lifecycle/block terms.
- `figma-skill/tests/green-results.md` — record deterministic v3 run after all tests pass.
- `figma-skill/tests/v2-green-results.md` — append v3 migration note so historical v2 evidence points forward.
- `figma-skill/tests/scenarios.md` — update pressure scenarios that reference old ledger behavior.
- `figma-skill/tests/expected-behaviors.md` — update expected choices for PlanWeave authority and old-ledger refusal.

### Files to create

- `figma-skill/tests/v3-skill-router.test.mjs` — contract tests for `SKILL.md` v3 router.
- `figma-skill/tests/v3-planweave-planning.test.mjs` — contract tests for planning/design-system references.
- `figma-skill/tests/v3-runtime-refs.test.mjs` — contract tests for state, recovery, execution, validation, geometry, and self-reflection references.

### Files to delete

- `figma-skill/scripts/figma-task-state.mjs`
- `figma-skill/scripts/lib/task-state/archive.mjs`
- `figma-skill/scripts/lib/task-state/checkpoint-commands.mjs`
- `figma-skill/scripts/lib/task-state/checkpoint.mjs`
- `figma-skill/scripts/lib/task-state/errors.mjs`
- `figma-skill/scripts/lib/task-state/event-ledger.mjs`
- `figma-skill/scripts/lib/task-state/evidence.mjs`
- `figma-skill/scripts/lib/task-state/lease-commands.mjs`
- `figma-skill/scripts/lib/task-state/lease.mjs`
- `figma-skill/scripts/lib/task-state/model.mjs`
- `figma-skill/scripts/lib/task-state/store.mjs`
- `figma-skill/scripts/lib/task-state/transaction.mjs`
- `figma-skill/scripts/lib/task-state/validate.mjs`
- `figma-skill/schemas/config.schema.json`
- `figma-skill/schemas/event.schema.json`
- `figma-skill/schemas/index.schema.json`
- `figma-skill/schemas/task-state.schema.json`
- `figma-skill/tests/task-state-archive.test.mjs`
- `figma-skill/tests/task-state-checkpoint.test.mjs`
- `figma-skill/tests/task-state-cli.test.mjs`
- `figma-skill/tests/task-state-evidence.test.mjs`
- `figma-skill/tests/task-state-lease.test.mjs`
- `figma-skill/tests/task-state-schema.test.mjs`
- `figma-skill/tests/plan-clipwhitelist.test.mjs`

### Files to keep unchanged unless tests force a wording adjustment

- `figma-skill/scripts/apply-layout.mjs`
- `figma-skill/scripts/figma-validate-bounds.mjs`
- `figma-skill/scripts/inspect-geometry.mjs`
- `figma-skill/scripts/list-children.mjs`
- `figma-skill/scripts/overlap-check.mjs`
- `figma-skill/scripts/page-overlap-check.mjs`
- `figma-skill/scripts/resize-section.mjs`
- `figma-skill/scripts/install-figma-cli.ps1`
- `figma-skill/tests/containment-gate.test.mjs`
- `figma-skill/tests/write-idempotency.test.mjs`
- `figma-skill/tests/figma-read-helpers.test.mjs`
- `figma-skill/tests/figma-write-helpers.test.mjs`
- `figma-skill/tests/figma-validate-bounds.test.mjs`
- `figma-skill/tests/install-figma-cli.Tests.ps1`
- `figma-skill/tests/helpers/run-figma-script.mjs`
- `figma-skill/tests/helpers/stub-figma-cli.mjs`

---

### Task 1: Add v3 SKILL router contract and rewrite `SKILL.md`

**Files:**
- Create: `figma-skill/tests/v3-skill-router.test.mjs`
- Modify: `figma-skill/SKILL.md`

**Interfaces:**
- Consumes: `SKILL.md` as the compact router for v3.
- Produces: version `3.0`, PlanWeave authority markers, figma-cli authority markers, Pre-Spec Context Gate markers, required references, three-page architecture, lifecycle markers, review-gate contract, and old-ledger refusal markers.

- [ ] **Step 1: Write the failing router contract test**

Create `figma-skill/tests/v3-skill-router.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(root, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");

function section(name) {
  const start = skill.indexOf(`## ${name}`);
  assert.notEqual(start, -1, `missing section: ${name}`);
  const next = skill.indexOf("\n## ", start + 1);
  return skill.slice(start, next === -1 ? undefined : next);
}

test("SKILL.md frontmatter declares figma-skill v3.0", () => {
  assert.match(skill, /^---[\s\S]+?---\n/);
  const fm = skill.match(/^---([\s\S]+?)---/)[1];
  assert.match(fm, /\bname:\s*figma-skill\b/);
  assert.match(fm, /\bdescription:\s*Use when\b/);
  assert.match(fm, /\bversion:\s*3\.0\b/);
});

test("SKILL.md states the three v3 authority boundaries", () => {
  const authority = section("Authority Invariant");
  assert.match(authority, /PlanWeave[\s\S]{0,80}workflow authority/);
  assert.match(authority, /figma-cli[\s\S]{0,80}Figma fact and mutation authority/);
  assert.match(authority, /\.figma\/);
  assert.match(authority, /screenshot\/<planweave-ref>/);
  assert.match(authority, /feedback\/<timestamp>\.md/);
  assert.doesNotMatch(authority, /task ledger|state machine|active workflow state|active ledger|archiveStatus\s*=/);
});

test("SKILL.md mandates Pre-Spec Context Gate before spec or plan", () => {
  const rules = section("Non-Negotiable Rules");
  assert.match(rules, /Pre-Spec Context Gate/);
  assert.match(rules, /docs\/FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,120}before spec drafting/);
  assert.match(rules, /figma-cli --version[\s\S]{0,120}figma-cli --help[\s\S]{0,120}figma-cli status/);
  assert.match(rules, /live Figma context[\s\S]{0,120}before spec drafting/);
  assert.match(rules, /no spec, no plan, no Figma write/i);
});

test("SKILL.md keeps figma-cli-only and eval-run six-field gates", () => {
  const rules = section("Non-Negotiable Rules");
  assert.match(rules, /禁止使用 Figma MCP/);
  for (const field of [
    "NativeHelpChecked",
    "MissingNativeCapability",
    "TargetNodeIds",
    "FallbackCodeScope",
    "FallbackImpact",
    "GeometryReaudit",
  ]) {
    assert.ok(rules.includes(field), `${field} missing`);
  }
});

test("SKILL.md routes phases to mandatory references", () => {
  const lookups = section("Mandatory Lookups");
  for (const ref of [
    "references/installation.md",
    "references/design-system.md",
    "references/planning.md",
    "references/state-and-recovery.md",
    "references/execution.md",
    "references/geometry-verifier.md",
    "references/validation.md",
    "references/self-reflection.md",
    "references/naming.md",
  ]) {
    assert.ok(lookups.includes(ref), `missing lookup: ${ref}`);
  }
});

test("SKILL.md defines v3 lifecycle and review contract", () => {
  const lifecycle = section("PlanWeave Lifecycle");
  for (const marker of [
    "Requirements discovery",
    "Pre-Spec Context Gate",
    "Spec Review Gate",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Figma Write Blocks",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(lifecycle.includes(marker), `missing lifecycle marker: ${marker}`);
  }
  const review = section("Review Gate Contract");
  assert.match(review, /result:\s*pass \| needs_changes/);
  assert.match(review, /targetBlock:/);
  assert.match(review, /reason:/);
  assert.match(review, /requiredChange:/);
});

test("SKILL.md preserves three-page architecture and task types", () => {
  for (const marker of ["01 Library", "02 Screens", "03 Flows"]) {
    assert.ok(skill.includes(marker), `missing page marker: ${marker}`);
  }
  for (const taskType of ["Create", "Modify", "Audit", "Migrate", "Export"]) {
    assert.ok(skill.includes(taskType), `missing task type: ${taskType}`);
  }
});

test("SKILL.md refuses old ledger commands instead of teaching them", () => {
  assert.doesNotMatch(skill, /figma-task-state\.mjs\s+(init-project|create|checkpoint|validate|archive|close|reflect)/);
  assert.doesNotMatch(skill, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(skill, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(skill, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
  const redFlags = section("Red Flags and Rationalizations");
  assert.match(redFlags, /old \.figma\/tasks ledger/);
  assert.match(redFlags, /PlanWeave/);
  assert.match(redFlags, /禁止/);
});
```

- [ ] **Step 2: Run the router test and verify the red result**

Run:

```bash
cd figma-skill && node --test tests/v3-skill-router.test.mjs
```

Expected: FAIL. The first failure should be the version assertion because `SKILL.md` still contains `version: 2.2`.

- [ ] **Step 3: Replace `SKILL.md` with the v3 router**

Replace the full contents of `figma-skill/SKILL.md` with:

```markdown
---
name: figma-skill
model: sonnet
category: design
description: Use when creating, modifying, extending, auditing, exporting, or validating product UI, components, variables, tokens, responsive layouts, or design systems in Figma or through figma-cli; also use when a request mentions Figma, figma-cli, NodeId, or PlanWeave Figma work.
version: 3.0
---

# Figma End-to-End Execution v3

将用户需求转化为可编辑、可复用、经过实际截图验收的 Figma 产品 UI。v3 硬依赖 PlanWeave：先了解需求与 live facts，再写 spec，再写 plan，最后执行。旧 `.figma/tasks` 账本不再是流程来源。

## Authority Invariant

- SKILL.md 是 v3 compact router：只负责强制门禁、必读 reference、PlanWeave 生命周期、review contract、Figma artifact 边界和 Red Flags。
- PlanWeave is the workflow authority：requirements discovery、spec approval、implementation plan approval、task/block dependencies、runner/reviewer prompts、`pass` / `needs_changes`、rework routing、completion 和 recovery 必须由 PlanWeave 承载。
- `figma-cli` is the Figma fact and mutation authority：环境检查、live reads、writes、exports、screenshots、geometry evidence 和 validation data 必须来自 `figma-cli`。
- `.figma/` 只保留 artifact duty：`.figma/screenshot/<planweave-ref>/` 保存视觉验收截图；`.figma/feedback/<timestamp>.md` 保存 self-reflection。`.figma/` 禁止承载 task plan、state、events、recovery 或 completion authority（历史 ledger 命名例如 `.figma/tasks`、`lease.json`、`events.jsonl`、`archiveStatus` 不再是 active state）。
- `scripts/{list-children,overlap-check,page-overlap-check,inspect-geometry,figma-validate-bounds}.mjs` 是只读 helper；`scripts/{apply-layout,resize-section}.mjs` 是写入 helper。所有 helper 只能通过批准的 `figma-cli run` 路径进入 Figma 任务。

## Non-Negotiable Rules

- 所有 Figma 读取、创建、修改、导出和验证必须使用 `figma-cli`。禁止使用 Figma MCP、其他 Figma CLI、GUI 自动化、直接 REST API 或记忆作为替代路径。
- Pre-Spec Context Gate 必须在 spec drafting 之前完成；未完成时 no spec, no plan, no Figma write。
- Pre-Spec Context Gate 必须确认用户目标、非目标、任务类型 (`Create | Modify | Audit | Migrate | Export`)、是否需要 Figma 写入，以及阻塞性未知项。
- Pre-Spec Context Gate 必须先读取 `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md`，before spec drafting。文档缺失或缺少当前任务规则时，必须先提出最小设计系统补充、说明依据/影响/范围外冲突、等待用户明确批准并更新文档；设计系统审批禁止授权 Figma 写入。
- 每个新会话首次执行需要 live Figma 的任务前必须按顺序运行 `figma-cli --version`、`figma-cli --help`、`figma-cli status`；只有未连接时才允许 `figma-cli connect`，随后必须再运行 `figma-cli status`。
- spec drafting 前必须通过 `figma-cli` live-read 当前文件/page/section/frame、直接 children、关键 geometry、相关 components、variables、styles、dependencies；视觉基线需要时截图写入 `.figma/screenshot/<planweave-ref>/`。
- Spec Gate 只描述完成时必须为真的状态：requirements、design-system basis、live facts、target state、affected nodes、naming、geometry/visual acceptance、out-of-scope、approved assumptions。禁止在 spec 中写 command sequence、write batch order、eval/run code、correction-loop details 或 runner/reviewer assignments。
- Plan Gate 必须生成 PlanWeave implementation canvas，包含 Plan Draft、Plan Review、Pre-write Live Revalidation、Figma Write Blocks、Geometry Validation、Correction、Visual Validation、Final Review、Delivery、Self-Reflection，并为每个失败路径写明 rework route。
- 只有 approved spec、approved plan、Pre-write Live Revalidation 三者均通过后，才允许任何 Figma 写入。
- `Audit` 与 `Export` 默认 `writeRequired=false`；它们禁止进入会修改 Figma 的 write/correction block，除非用户开启新的 write-capable task。
- 只有 `NativeHelpChecked`、`MissingNativeCapability`、`TargetNodeIds`、`FallbackCodeScope`、`FallbackImpact`、`GeometryReaudit` 六字段完整且在 PlanWeave write block 中经批准时，才允许使用 `eval/run` 或任何非原生 figma-cli 能力。
- duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId、parent relation 和 geometry，再继续写入。
- 验证失败最多自动修正三轮（≤3）；仍失败必须停止写入，并由 PlanWeave 记录失败证据与 recovery options。
- 截图必须保存到 `.figma/screenshot/<planweave-ref>/`，必须实际打开并目视检查；导出成功或 exit 0 禁止替代看图。
- Self-Reflection Block 必须写 `.figma/feedback/<timestamp>.md`；文件必须包含问题列表和优化方向，且不得包含 daemon token、凭据或敏感绝对路径。
- 硬性要求必须用「必须」「禁止」「只有……才允许」；禁止用弱措辞稀释门禁。

## Mandatory Lookups

```text
Pre-Spec Context Gate（需求 / 设计系统 / 环境 / live facts）
  → references/planning.md
  → references/design-system.md
  → references/installation.md

Spec Canvas / Implementation Canvas / Review Gates / fixed final blocks
  → references/planning.md

State / recovery / stale context / needs_changes routing
  → references/state-and-recovery.md

Figma write execution / command truth / eval-run fallback / helper scripts
  → references/execution.md

Geometry validation / correction loop
  → references/geometry-verifier.md

Visual validation / final review / delivery
  → references/validation.md

Self-reflection artifact
  → references/self-reflection.md

Naming / component paths / variant grammar
  → references/naming.md
```

禁止：用 SKILL.md 替代以上任何一次加载。禁止：在未加载 `references/planning.md` 与 `references/design-system.md` 的情况下写 spec。

## Three-Page Architecture

```text
01 Library
02 Screens
03 Flows
```

禁止创建第四个 Page。`01 Library` 内部按 Section 分区（`00 Foundations`、`10 Components`、`80 Internal`、`90 Deprecated`）。`02 Screens` 通过业务域和 Flow Section 组织；`03 Flows` 只承载流程编排，不承载权威 Component 或 Screen。截图由 `.figma/screenshot/<planweave-ref>/` 管理，不进入 Page。

## PlanWeave Lifecycle

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
  → Geometry Validation Block
  → Correction Block as needed
  → Visual Validation Block
  → Final Review Gate
  → Delivery Block
  → Self-Reflection Block
```

Routing rules:

- Requirements unclear → ask targeted questions before spec.
- Pre-Spec Context Gate incomplete → no spec, no plan, no Figma write.
- Spec Review Gate `needs_changes` → return to the named requirements/design-system/live-context/spec block.
- Plan Review Gate `needs_changes` → return to Plan Draft Block.
- Pre-write live revalidation conflicts with approved plan → return to Plan Draft or Spec Draft according to drift source.
- Geometry or visual validation fails → Correction Block, then rerun affected validation.
- Final Review Gate `needs_changes` → reviewer names the smallest responsible block.
- Correction budget exhausted → stop writes and present recovery options through PlanWeave.

## Review Gate Contract

Every Figma PlanWeave review gate must return exactly one of these YAML forms. The accepted literal values for `result` are `pass` or `needs_changes`:

```yaml
# result: pass | needs_changes
result: pass
checked:
  - spec_coverage
  - design_system_alignment
  - figma_live_evidence
  - dependency_order
  - validation_evidence
  - visual_evidence
  - out_of_scope_integrity
```

or:

```yaml
result: needs_changes
checked:
  - spec_coverage
  - design_system_alignment
  - figma_live_evidence
  - dependency_order
  - validation_evidence
  - visual_evidence
  - out_of_scope_integrity
targetBlock: <block-id>
reason: <specific failure>
requiredChange: <observable correction>
```

`needs_changes` 必须写 targetBlock、reason、requiredChange。Reviewer 禁止在已知 geometry、visual、evidence 或 scope failure 存在时 pass。

## Fixed Final Blocks

Write-capable implementation plans must include:

1. Pre-write Live Revalidation Block;
2. Figma Write Blocks;
3. Geometry Validation Block;
4. Correction Block with ≤3 budget;
5. Visual Validation Block;
6. Final Review Gate;
7. Delivery Block;
8. Self-Reflection Block;
9. `.figma/screenshot/<planweave-ref>/` artifact handling;
10. `.figma/feedback/<timestamp>.md` artifact handling.

A plan missing any required final block fails Plan Review.

## Red Flags and Rationalizations

- "先写 plan，执行时再读 FIGMA_DESIGN_SYSTEM.md" → 错；设计系统读取属于 Pre-Spec Context Gate，必须在 spec drafting 之前完成。
- "旧 .figma/tasks ledger 里有 plan，可以直接继续" → 错；old .figma/tasks ledger is not workflow authority。必须通过 PlanWeave state/recovery，并 live-read Figma facts。
- "PlanWeave 已记录 NodeId，所以不用重新读" → 错；PlanWeave 记录是 orchestration evidence，不替代 live Figma read。
- "Audit 只是小修一下" → 错；`Audit` / `Export` 的 read-only 约束禁止任何 Figma mutation。
- "Spec Review 有小问题但我知道怎么改，先继续" → 错；`needs_changes` 必须返回 targetBlock 并重做对应 block。
- "Plan 缺少 final review，但我会自己看" → 错；Final Review Gate 是固定 final block，禁止省略。
- "截图导出成功就是视觉通过" → 错；必须实际打开截图并写出视觉结论。
- "自省只是维护者用，不影响完成" → 错；Self-Reflection Block 是 v3 final block。
```

- [ ] **Step 4: Run the router test and verify it passes**

Run:

```bash
cd figma-skill && node --test tests/v3-skill-router.test.mjs
```

Expected: PASS with 8 tests and 0 failures.

- [ ] **Step 5: Run existing quick structural tests and record expected temporary failures**

Run from repository root:

```bash
node figma-skill/tests/validate-skill.mjs
```

Expected: FAIL because `validate-skill.mjs` still asserts v2 required files and version markers. This failure is expected until Task 5.

- [ ] **Step 6: Commit Task 1**

```bash
git add figma-skill/SKILL.md figma-skill/tests/v3-skill-router.test.mjs
git commit -m "feat(figma-skill): add v3 PlanWeave router contract"
```

---

### Task 2: Add planning/design-system contract and rewrite planning references

**Files:**
- Create: `figma-skill/tests/v3-planweave-planning.test.mjs`
- Modify: `figma-skill/references/planning.md`
- Modify: `figma-skill/references/design-system.md`

**Interfaces:**
- Consumes: `SKILL.md` router from Task 1.
- Produces: v3 planning authority with Pre-Spec Context Gate, Spec Canvas, Implementation Canvas, fixed final block lint, structured review-gate output, and explicit design-system pre-spec rules.

- [ ] **Step 1: Write the failing planning contract test**

Create `figma-skill/tests/v3-planweave-planning.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const planning = read("references/planning.md");
const designSystem = read("references/design-system.md");

test("planning.md defines Pre-Spec Context Gate before any spec drafting", () => {
  assert.match(planning, /## Pre-Spec Context Gate/);
  assert.match(planning, /docs\/FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,160}before spec drafting/);
  assert.match(planning, /figma-cli --version[\s\S]{0,160}figma-cli --help[\s\S]{0,160}figma-cli status/);
  assert.match(planning, /live Figma context[\s\S]{0,160}before spec drafting/);
  assert.doesNotMatch(planning, /Step 1:\s*read\s+FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,80}implementation plan/i);
});

test("planning.md defines required Spec Canvas blocks", () => {
  for (const marker of [
    "Requirements Discovery Block",
    "Design System Context Block",
    "Figma Live Context Block",
    "Spec Draft Block",
    "Spec Review Gate",
  ]) {
    assert.ok(planning.includes(marker), `missing spec canvas marker: ${marker}`);
  }
});

test("planning.md defines required Implementation Canvas blocks", () => {
  for (const marker of [
    "Plan Draft Block",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Figma Write Blocks",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(planning.includes(marker), `missing implementation canvas marker: ${marker}`);
  }
});

test("planning.md requires fixed final blocks and rework routing", () => {
  assert.match(planning, /Fixed Final Blocks as Plan Lint/);
  assert.match(planning, /\.figma\/screenshot\/<planweave-ref>/);
  assert.match(planning, /\.figma\/feedback\/<timestamp>\.md/);
  assert.match(planning, /rework route/);
  assert.match(planning, /fails Plan Review/);
});

test("planning.md defines structured pass needs_changes review output", () => {
  assert.match(planning, /result:\s*pass \| needs_changes/);
  assert.match(planning, /targetBlock:/);
  assert.match(planning, /reason:/);
  assert.match(planning, /requiredChange:/);
});

test("planning.md does not teach old task ledger plan construction", () => {
  assert.doesNotMatch(planning, /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate)/);
  assert.doesNotMatch(planning, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(planning, /state\.json|events\.jsonl|lease\.json|archiveStatus/);
  assert.doesNotMatch(planning, /Task\.currentWorkflow|GateStatus/);
});

test("design-system.md marks design-system work as pre-spec and not Figma approval", () => {
  assert.match(designSystem, /Pre-Spec Context Gate/);
  assert.match(designSystem, /docs\/FIGMA_DESIGN_SYSTEM\.md/);
  assert.match(designSystem, /before spec drafting/);
  assert.match(designSystem, /Design-system approval does not authorize Figma writes/);
});
```

- [ ] **Step 2: Run the planning contract and verify the red result**

Run:

```bash
cd figma-skill && node --test tests/v3-planweave-planning.test.mjs
```

Expected: FAIL because `planning.md` still describes v2 workflow gates and old task ledger construction.

- [ ] **Step 3: Replace `references/planning.md` with v3 PlanWeave planning authority**

Replace `figma-skill/references/planning.md` with:

```markdown
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
```

- [ ] **Step 4: Replace `references/design-system.md` with v3 design-system authority**

Replace `figma-skill/references/design-system.md` with:

```markdown
# Design-System Authority

## Workspace Path

`<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md` is the only design-system source for figma-skill work. The current workspace is the directory selected and authorized by the user when Claude Code or Codex starts. Changing shell directories or discovering a parent `.git` directory does not redefine the workspace.

## Pre-Spec Context Gate

The design-system document must be read before spec drafting. This read is pre-spec evidence, not a step inside the implementation plan.

The spec must cite the specific design-system rules that govern the task. If the document is missing or lacks rules needed for the task, the agent must stop spec drafting and propose the minimum design-system addition.

## Required Coverage

The document must cover the current task's needed:

- design principles and target platforms;
- colors and semantic roles;
- typography hierarchy;
- spacing and sizing scale;
- grid and responsive breakpoints;
- radius, stroke, and shadow rules;
- icon system;
- base components and states;
- interaction states and accessibility floor;
- naming and component organization.

## Missing Document

When `docs/FIGMA_DESIGN_SYSTEM.md` is missing, build the minimum current-task draft using this priority order:

1. explicit user requirements and brand material;
2. existing Figma variables, styles, and components read through `figma-cli`;
3. stable repeated visual patterns in the target page;
4. professional defaults only when the first three sources are absent.

Show the proposed rules, basis, impact, and out-of-scope conflicts. Wait for explicit design-system approval before writing the document.

## Incomplete Document

When the document lacks current-task rules, add only the minimum missing rule set after approval. Do not use temporary defaults to bypass the gap. Do not modify Figma before the design-system gap is resolved.

## Conflict Policy

The document outranks existing Figma. Approved task scope and direct dependencies must be corrected to match the document. Out-of-scope historical conflicts are reported, not fixed. If correcting a direct dependency affects other pages, disclose that before approval.

## Approval Boundary

Design-system approval does not authorize Figma writes. After the design-system basis is approved, the task still needs an approved spec, approved implementation plan, and pre-write live revalidation before any Figma write.
```

- [ ] **Step 5: Run planning tests and router tests**

Run:

```bash
cd figma-skill && node --test tests/v3-planweave-planning.test.mjs tests/v3-skill-router.test.mjs
```

Expected: PASS with 15 tests and 0 failures.

- [ ] **Step 6: Commit Task 2**

```bash
git add figma-skill/references/planning.md figma-skill/references/design-system.md figma-skill/tests/v3-planweave-planning.test.mjs
git commit -m "docs(figma-skill): define v3 PlanWeave planning gates"
```

---

### Task 3: Add runtime reference contract and rewrite state/execution/validation/self-reflection docs

**Files:**
- Create: `figma-skill/tests/v3-runtime-refs.test.mjs`
- Modify: `figma-skill/references/state-and-recovery.md`
- Modify: `figma-skill/references/execution.md`
- Modify: `figma-skill/references/validation.md`
- Modify: `figma-skill/references/self-reflection.md`
- Modify: `figma-skill/references/geometry-verifier.md`
- Modify: `figma-skill/references/naming.md`
- Modify: `figma-skill/references/installation.md`

**Interfaces:**
- Consumes: v3 router and planning references from Tasks 1–2.
- Produces: v3 runtime references that route state/recovery through PlanWeave, execution through figma-cli, validation evidence through PlanWeave review gates, and self-reflection through `.figma/feedback`.

- [ ] **Step 1: Write the failing runtime reference test**

Create `figma-skill/tests/v3-runtime-refs.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");

const refs = {
  state: read("references/state-and-recovery.md"),
  execution: read("references/execution.md"),
  validation: read("references/validation.md"),
  reflection: read("references/self-reflection.md"),
  geometry: read("references/geometry-verifier.md"),
  naming: read("references/naming.md"),
  installation: read("references/installation.md"),
};

const joined = Object.values(refs).join("\n");

test("state-and-recovery.md uses PlanWeave as state authority", () => {
  assert.match(refs.state, /PlanWeave[\s\S]{0,100}state authority/);
  for (const cmd of [
    "planweave status",
    "planweave current",
    "planweave claim",
    "planweave prompt",
    "planweave submit",
    "plan-recovery",
  ]) {
    assert.ok(refs.state.includes(cmd), `missing state command marker: ${cmd}`);
  }
  assert.match(refs.state, /needs_changes[\s\S]{0,120}targetBlock/);
  assert.match(refs.state, /live-revalidate/);
});

test("execution.md preserves figma-cli command truth and eval-run six fields", () => {
  assert.match(refs.execution, /figma-cli <command>/);
  assert.match(refs.execution, /figma-cli <command> <subcommand> --help/);
  for (const field of [
    "NativeHelpChecked",
    "MissingNativeCapability",
    "TargetNodeIds",
    "FallbackCodeScope",
    "FallbackImpact",
    "GeometryReaudit",
  ]) {
    assert.ok(refs.execution.includes(field), `${field} missing`);
  }
  assert.match(refs.execution, /Pre-write Live Revalidation Block/);
});

test("validation.md feeds PlanWeave review and uses planweave screenshot refs", () => {
  assert.match(refs.validation, /PlanWeave Final Review Gate/);
  assert.match(refs.validation, /\.figma\/screenshot\/<planweave-ref>/);
  assert.match(refs.validation, /actual visual inspection|实际打开/);
  assert.match(refs.validation, /Correction Block/);
  assert.match(refs.validation, /Delivery Block/);
});

test("self-reflection.md writes feedback artifact without task ledger helper", () => {
  assert.match(refs.reflection, /Self-Reflection Block/);
  assert.match(refs.reflection, /\.figma\/feedback\/<timestamp>\.md/);
  assert.match(refs.reflection, /# figma-skill v3\.0 Self-Reflection/);
  assert.doesNotMatch(refs.reflection, /figma-task-state\.mjs\s+reflect/);
  assert.doesNotMatch(refs.reflection, /events\.jsonl|archiveStatus|lease/);
});

test("geometry-verifier.md preserves seven gates and points visual artifacts to planweave-ref", () => {
  const order = [
    "Gate 1 — Lint",
    "Gate 2 — Duplicate-Origin",
    "Gate 3 — Top-Level AABB",
    "Gate 4 — Scoped Children AABB",
    "Gate 5 — Variant Parity",
    "Gate 6 — Visual",
    "Gate 7 — Containment",
  ];
  let cursor = -1;
  for (const marker of order) {
    const next = refs.geometry.indexOf(marker);
    assert.ok(next > cursor, `${marker} missing or out of order`);
    cursor = next;
  }
  assert.match(refs.geometry, /\.figma\/screenshot\/<planweave-ref>/);
});

test("naming and installation references no longer mention v2 workflow routing", () => {
  assert.doesNotMatch(refs.naming, /Workflow\s+[0-9A-I]/);
  assert.match(refs.naming, /PlanWeave/);
  assert.match(refs.installation, /Pre-Spec Context Gate/);
});

test("runtime references do not teach active old ledger commands", () => {
  assert.doesNotMatch(joined, /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate|archive|close|reflect)/);
  assert.doesNotMatch(joined, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(joined, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(joined, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
  assert.doesNotMatch(joined, /lease\.json/);
  assert.doesNotMatch(joined, /events\.jsonl/);
});
```

- [ ] **Step 2: Run the runtime reference test and verify the red result**

Run:

```bash
cd figma-skill && node --test tests/v3-runtime-refs.test.mjs
```

Expected: FAIL because state, execution, validation, and self-reflection references still describe the v2 ledger.

- [ ] **Step 3: Replace `references/state-and-recovery.md`**

Replace `figma-skill/references/state-and-recovery.md` with:

```markdown
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
```

- [ ] **Step 4: Replace `references/execution.md`**

Replace `figma-skill/references/execution.md` with:

```markdown
# Approved Figma Execution

Execution is authorized by an approved PlanWeave implementation block. `figma-cli` is the only Figma fact and mutation authority.

## Pre-write Live Revalidation Block

Immediately before any write, re-read:

- target node ids, names, types, parents, positions, and sizes;
- direct children of the mutation scope;
- Auto Layout, constraints, and sizing behavior;
- components, Component Sets, variants, instances, variables, and styles affected by the block;
- screenshots when visual baseline affects the block.

Drift from the approved spec or plan returns to Plan Draft Block or Spec Draft Block. Do not patch around drift inside the write block.

## Singular Environment Order

Every new figma-cli session must run:

```text
figma-cli --version
figma-cli --help
figma-cli status
  if connected-to-figma and daemon-running → continue
  otherwise figma-cli connect, then status again
```

This order is Pre-Spec Context Gate evidence for tasks that require live Figma.

## Command Truth

Before first use of a command in the current session, query:

```text
figma-cli <command> --help
figma-cli <command> <subcommand> --help
```

If the needed subcommand or flag is not present in current help output, do not execute it. Do not rely on memory, examples, or third-party docs.

## Unified `eval/run` Contract

Only use `eval/run` or non-native helper execution when the PlanWeave write block includes all six fields and the user has approved the block:

1. `NativeHelpChecked` — top-level and nearest subcommand help checked;
2. `MissingNativeCapability` — closest native command lacks the required capability;
3. `TargetNodeIds` — exact NodeIds affected;
4. `FallbackCodeScope` — exact code or helper scope;
5. `FallbackImpact` — impact radius;
6. `GeometryReaudit` — how affected geometry will be rechecked.

After any fallback, re-read affected nodes and submit evidence to PlanWeave.

## Geometry-aware Commands

| Need | Command |
| --- | --- |
| File lint | `figma-cli lint --json` |
| Duplicate-origin dry run | `figma-cli unstack --dry-run` |
| Canvas information | `figma-cli canvas info` |
| Next non-overlap position | `figma-cli canvas next` |
| Section children | `figma-cli run scripts/list-children.mjs` |
| Node geometry and sizing | `figma-cli inspect --json <id>` |
| Section AABB matrix | `figma-cli run scripts/overlap-check.mjs` |
| Page top-level AABB | `figma-cli run scripts/page-overlap-check.mjs` |
| Full node geometry | `figma-cli run scripts/inspect-geometry.mjs` |
| Apply movement plan | `figma-cli run scripts/apply-layout.mjs` |
| Resize section | `figma-cli run scripts/resize-section.mjs` |

Read-only helpers (`list-children`, `overlap-check`, `page-overlap-check`, `inspect-geometry`, `figma-validate-bounds`) do not mutate Figma. Write helpers (`apply-layout`, `resize-section`) require an approved PlanWeave write block and must be followed by live re-read.

## Small-Batch Loop

Each write block executes the smallest coherent mutation group:

1. read target state;
2. perform one coherent mutation group;
3. re-read affected nodes;
4. check structural expectations;
5. submit evidence to PlanWeave;
6. continue only after the block evidence matches the approved plan.

After duplicate, reparent, unwrap, componentization, combining variants, delete/recreate, or major hierarchy changes, re-read NodeIds and geometry before the next write.

## Write order and `--check-exists`

For `figma-cli create.*` commands that create a single named node, use `--check-exists` when daemon retry or duplicate creation is possible.

Behavior contract:

```text
figma-cli create section --name "X" --parent P --check-exists
  ├─ not found → create and return new nodeId
  ├─ found, no --reuse → return DUPLICATE_NODE, exit 3
  ├─ found, --reuse → return existingId with reused: true, exit 0
  └─ found, --strict → abort, exit 4
```

Only pass `--reuse` after a live-read confirms the existing node matches the approved plan.

## Failure Handling

Partial success or severe deviation stops downstream writes. Submit the failure, command output, affected NodeIds, and live re-read evidence to PlanWeave. Only use undo when current help and batch history prove it precisely targets the most recent mutation.
```

- [ ] **Step 5: Replace `references/validation.md`**

Replace `figma-skill/references/validation.md` with:

```markdown
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
```

- [ ] **Step 6: Replace `references/self-reflection.md`**

Replace `figma-skill/references/self-reflection.md` with:

```markdown
# Self-Reflection Block

Self-Reflection Block is the final maintenance artifact for figma-skill v3 tasks. It does not mutate Figma and does not change PlanWeave task state.

## Purpose

Record concrete problems observed while using this skill and actionable improvements for future skill maintenance.

## Storage Path

```text
<Current workspace>/.figma/feedback/<timestamp>.md
```

`<timestamp>` uses file-name-safe ISO 8601 local time: `YYYY-MM-DDTHH-MM-SS`. The filename contains only the timestamp unless a same-second collision requires a numeric suffix.

## Required File Structure

```markdown
# figma-skill v3.0 Self-Reflection
<!-- skill-version: 3.0 -->

## 1. Problems

| # | Problem | PlanWeave Block or Gate | Impact |
| - | ------- | ----------------------- | ------ |
| 1 | A concrete observation from this task. | <block-or-gate> | Observable impact. |

## 2. Optimization Directions

| # | Direction | Priority | Related Problem |
| - | --------- | -------- | --------------- |
| 1 | A concrete change that can be made to the skill or tests. | P1 | Problem #1 |
```

Requirements:

- Both tables must exist.
- Each table must contain at least one row.
- Priority must be `P0`, `P1`, or `P2`.
- Related Problem references must point to a row in the Problems table.
- The file must not include daemon tokens, credentials, authorization headers, or sensitive absolute paths.

## Failure Handling

If the reflection file cannot be written safely, report the failure in the Delivery Block and mark the Self-Reflection Block as failing. Do not hide the failure by claiming task completion.
```

- [ ] **Step 7: Patch geometry, naming, and installation references**

In `figma-skill/references/geometry-verifier.md`:

- Replace title `# Geometry Verifier Pipeline (Workflow 9 / 10)` with `# Geometry Verifier Pipeline`.
- Replace `Workflow 9 Geometry` with `Geometry Validation Block`.
- Replace `Workflow 10` with `Correction Block`.
- Replace `.figma/screenshot/<task-id>/` with `.figma/screenshot/<planweave-ref>/`.
- Replace `plan.md##ClipWhitelist` with `the approved PlanWeave implementation plan's ClipWhitelist evidence`.
- Replace `schema 由 assertValidPlan 校验` with `Plan Review Gate checks every whitelist entry for nodeId and rationale`.

In `figma-skill/references/naming.md`:

- Replace `Workflow 2, 4A–4H, 5` with `Pre-Spec Context Gate, Spec Canvas, and PlanWeave implementation planning`.
- Add this sentence after the opening paragraph: `PlanWeave blocks may cite naming decisions, but canonical naming grammar remains in this file.`

In `figma-skill/references/installation.md`:

- Rename `## Singular Yolo Connection Gate` to `## Pre-Spec Environment Gate`.
- Add after the command block: `This command output is Pre-Spec Context Gate evidence for tasks requiring live Figma access.`

- [ ] **Step 8: Run runtime tests**

Run:

```bash
cd figma-skill && node --test tests/v3-runtime-refs.test.mjs tests/v3-planweave-planning.test.mjs tests/v3-skill-router.test.mjs
```

Expected: PASS with 22 tests and 0 failures.

- [ ] **Step 9: Commit Task 3**

```bash
git add figma-skill/references/state-and-recovery.md figma-skill/references/execution.md figma-skill/references/validation.md figma-skill/references/self-reflection.md figma-skill/references/geometry-verifier.md figma-skill/references/naming.md figma-skill/references/installation.md figma-skill/tests/v3-runtime-refs.test.mjs
git commit -m "docs(figma-skill): route runtime references through PlanWeave"
```

---

### Task 4: Delete old ledger implementation and ledger-only tests

**Files:**
- Delete: all old task-state implementation, schemas, and ledger-only tests listed in File Structure.
- Modify: `figma-skill/scripts/README.md`

**Interfaces:**
- Consumes: v3 docs and tests from Tasks 1–3.
- Produces: repository no longer contains the old task ledger implementation or tests that import it.

- [ ] **Step 1: Verify current imports before deletion**

Run:

```bash
git grep -n "scripts/lib/task-state\|figma-task-state\.mjs\|schemas/task-state\|schemas/event\|schemas/index\|schemas/config" figma-skill
```

Expected: matches in old implementation/tests plus documentation. The old implementation and ledger-only tests are deleted in this task; remaining docs are fixed in this task or Task 5.

- [ ] **Step 2: Delete old ledger files**

Run:

```bash
rm -f figma-skill/scripts/figma-task-state.mjs
rm -rf figma-skill/scripts/lib/task-state
rm -f figma-skill/schemas/config.schema.json figma-skill/schemas/event.schema.json figma-skill/schemas/index.schema.json figma-skill/schemas/task-state.schema.json
rm -f figma-skill/tests/task-state-archive.test.mjs figma-skill/tests/task-state-checkpoint.test.mjs figma-skill/tests/task-state-cli.test.mjs figma-skill/tests/task-state-evidence.test.mjs figma-skill/tests/task-state-lease.test.mjs figma-skill/tests/task-state-schema.test.mjs figma-skill/tests/plan-clipwhitelist.test.mjs
```

- [ ] **Step 3: Replace `scripts/README.md` with helper-only content**

Replace `figma-skill/scripts/README.md` with:

```markdown
# figma-skill helper scripts

These scripts support figma-skill v3 PlanWeave-orchestrated tasks. PlanWeave owns workflow state. `figma-cli` owns Figma reads and writes. These helpers do not create task state.

## Read-only helpers

- `list-children.mjs` — lists direct children for a target node.
- `overlap-check.mjs` — checks scoped child AABB overlap and Containment Gate data.
- `page-overlap-check.mjs` — checks top-level page AABB overlap.
- `inspect-geometry.mjs` — reports detailed geometry for a target node.
- `figma-validate-bounds.mjs` — offline JSON bounds analysis for specific geometry risks.

Read-only helpers must be run through `figma-cli run` when they need live Figma data. `figma-validate-bounds.mjs` may analyze exported JSON without contacting Figma.

## Write helpers

- `apply-layout.mjs` — applies an approved movement plan.
- `resize-section.mjs` — resizes approved sections.

Write helpers require an approved PlanWeave write block, fresh pre-write live revalidation, and post-write live re-read evidence.

## Installer

- `install-figma-cli.ps1` installs `figma-cli` on Windows from the approved GitHub Releases flow described in `references/installation.md`.
```

- [ ] **Step 4: Verify old imports are gone from active code and tests**

Run:

```bash
git grep -n "scripts/lib/task-state\|from .*task-state\|figma-task-state\.mjs" figma-skill/scripts figma-skill/tests
```

Expected: no matches. If the command exits with code 1 because no matches were found, that is the expected result.

- [ ] **Step 5: Run kept helper tests**

Run:

```bash
cd figma-skill && node --test tests/containment-gate.test.mjs tests/write-idempotency.test.mjs tests/figma-read-helpers.test.mjs tests/figma-write-helpers.test.mjs tests/figma-validate-bounds.test.mjs
```

Expected: PASS. These tests do not import the deleted task-state implementation.

- [ ] **Step 6: Commit Task 4**

```bash
git add -A figma-skill/scripts figma-skill/schemas figma-skill/tests figma-skill/scripts/README.md
git commit -m "refactor(figma-skill): remove v2 task ledger implementation"
```

---

### Task 5: Rewrite structural and workflow contract tests for v3

**Files:**
- Modify: `figma-skill/tests/validate-skill.mjs`
- Modify: `figma-skill/tests/workflow-contract.test.mjs`
- Modify: `figma-skill/tests/naming-and-workflow.test.mjs`

**Interfaces:**
- Consumes: v3 docs and deletion from Tasks 1–4.
- Produces: deterministic tests that no longer import deleted code and still preserve high-value figma-skill invariants.

- [ ] **Step 1: Replace `tests/validate-skill.mjs`**

Replace `figma-skill/tests/validate-skill.mjs` with:

```javascript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");

const required = [
  "SKILL.md",
  "references/installation.md",
  "references/design-system.md",
  "references/state-and-recovery.md",
  "references/planning.md",
  "references/execution.md",
  "references/validation.md",
  "references/geometry-verifier.md",
  "references/naming.md",
  "references/self-reflection.md",
  "scripts/install-figma-cli.ps1",
  "scripts/figma-validate-bounds.mjs",
  "scripts/list-children.mjs",
  "scripts/overlap-check.mjs",
  "scripts/page-overlap-check.mjs",
  "scripts/inspect-geometry.mjs",
  "scripts/apply-layout.mjs",
  "scripts/resize-section.mjs",
  "scripts/README.md",
];

for (const file of required) {
  assert.ok(existsSync(join(root, file)), `missing ${file}`);
}

for (const removed of [
  "scripts/figma-task-state.mjs",
  "scripts/lib/task-state/model.mjs",
  "schemas/config.schema.json",
  "schemas/event.schema.json",
  "schemas/index.schema.json",
  "schemas/task-state.schema.json",
]) {
  assert.ok(!existsSync(join(root, removed)), `removed ledger file still exists: ${removed}`);
}

const skill = read("SKILL.md");
const refs = Object.fromEntries(
  required.filter((file) => file.startsWith("references/")).map((file) => [file, read(file)]),
);
const runtimeMarkdown = [skill, ...Object.values(refs), read("scripts/README.md")].join("\n");

assert.ok(skill.startsWith("---\n"), "frontmatter must be first");
for (const field of ["name: figma-skill", "model:", "category:", "description:", "version: 3.0"]) {
  assert.match(skill, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const phrase of [
  "PlanWeave is the workflow authority",
  "figma-cli is the Figma fact and mutation authority",
  ".figma/screenshot/<planweave-ref>/",
  ".figma/feedback/<timestamp>.md",
  "Pre-Spec Context Gate",
  "docs/FIGMA_DESIGN_SYSTEM.md",
  "Spec Review Gate",
  "Plan Review Gate",
  "Final Review Gate",
  "Self-Reflection Block",
]) {
  assert.ok(runtimeMarkdown.includes(phrase), `missing v3 marker: ${phrase}`);
}

for (const field of [
  "NativeHelpChecked",
  "MissingNativeCapability",
  "TargetNodeIds",
  "FallbackCodeScope",
  "FallbackImpact",
  "GeometryReaudit",
]) {
  assert.ok(runtimeMarkdown.includes(field), `missing eval/run field: ${field}`);
}

for (const marker of [
  "01 Library",
  "02 Screens",
  "03 Flows",
  "Component Path",
  "Specimen/StateGallery",
  "Variant Parity",
  "Gate 7 — Containment",
]) {
  assert.ok(runtimeMarkdown.includes(marker), `missing preserved marker: ${marker}`);
}

for (const forbidden of [
  /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate|archive|close|reflect)/,
  /\.figma\/tasks\/<task-id>\//,
  /state\.validation\.visual\.summary/,
  /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/,
  /lease\.json/,
  /events\.jsonl/,
]) {
  assert.doesNotMatch(runtimeMarkdown, forbidden);
}

assert.doesNotMatch(runtimeMarkdown, /\.figma\/cache\.json/);
assert.doesNotMatch(runtimeMarkdown, /temp\/figma-screenshot/);
assert.doesNotMatch(runtimeMarkdown, /figma-guide/);

console.log("PASS: figma-skill v3 PlanWeave structure, references, preserved invariants, and old-ledger removal");
```

- [ ] **Step 2: Replace `tests/workflow-contract.test.mjs`**

Replace `figma-skill/tests/workflow-contract.test.mjs` with:

```javascript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const read = (name) => readFileSync(join(skillRoot, name), "utf8").replace(/\r\n/g, "\n");
const skill = read("SKILL.md");
const refs = {
  planning: read("references/planning.md"),
  state: read("references/state-and-recovery.md"),
  execution: read("references/execution.md"),
  geometry: read("references/geometry-verifier.md"),
  validation: read("references/validation.md"),
  designSystem: read("references/design-system.md"),
  selfReflection: read("references/self-reflection.md"),
  naming: read("references/naming.md"),
  installation: read("references/installation.md"),
};
const joined = `${skill}\n${Object.values(refs).join("\n")}`;

test("frontmatter description is trigger-only and version is 3.0", () => {
  assert.match(skill, /^---[\s\S]+?---\n/);
  const fm = skill.match(/^---([\s\S]+?)---/)[1];
  assert.match(fm, /\bname:\s*figma-skill\b/);
  assert.match(fm, /\bdescription:\s*Use when\b/);
  assert.match(fm, /\bversion:\s*3\.0\b/);
});

test("SKILL.md stays compact", () => {
  const lines = skill.split("\n");
  const words = skill.match(/\S+/g) || [];
  assert.ok(lines.length <= 260, `lines=${lines.length}`);
  assert.ok(words.length <= 1900, `words=${words.length}`);
});

test("PlanWeave owns workflow and figma-cli owns Figma facts", () => {
  assert.match(joined, /PlanWeave[\s\S]{0,120}workflow authority/);
  assert.match(joined, /figma-cli[\s\S]{0,120}Figma fact and mutation authority/);
});

test("Pre-Spec Context Gate is before spec drafting", () => {
  assert.match(joined, /Pre-Spec Context Gate/);
  assert.match(joined, /docs\/FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,160}before spec drafting/);
  assert.match(joined, /live Figma context[\s\S]{0,160}before spec drafting/);
});

test("PlanWeave canvases and final blocks are documented", () => {
  for (const marker of [
    "Spec Canvas",
    "Implementation Canvas",
    "Requirements Discovery Block",
    "Spec Review Gate",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(joined.includes(marker), `missing marker: ${marker}`);
  }
});

test("review gates require structured needs_changes routing", () => {
  assert.match(joined, /result:\s*pass \| needs_changes/);
  assert.match(joined, /targetBlock:/);
  assert.match(joined, /requiredChange:/);
});

test("old task ledger implementation is absent", () => {
  for (const removed of [
    "scripts/figma-task-state.mjs",
    "scripts/lib/task-state/model.mjs",
    "schemas/task-state.schema.json",
    "schemas/event.schema.json",
    "schemas/index.schema.json",
    "schemas/config.schema.json",
  ]) {
    assert.ok(!existsSync(join(skillRoot, removed)), `${removed} should be deleted`);
  }
});

test("runtime docs do not teach active ledger commands", () => {
  assert.doesNotMatch(joined, /figma-task-state\.mjs\s+(init-project|create|checkpoint|validate|archive|reflect)/);
  assert.doesNotMatch(joined, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(joined, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(joined, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
});

test("preserved Figma invariants remain documented", () => {
  for (const marker of [
    "Figma MCP",
    "figma-cli --version",
    "figma-cli --help",
    "figma-cli status",
    "NativeHelpChecked",
    "Variant Parity",
    "Gate 7 — Containment",
    ".figma/screenshot/<planweave-ref>/",
    ".figma/feedback/<timestamp>.md",
    "Specimen/StateGallery",
  ]) {
    assert.ok(joined.includes(marker), `missing invariant: ${marker}`);
  }
});
```

- [ ] **Step 3: Patch `tests/naming-and-workflow.test.mjs` workflow assertions**

Replace the test named `SKILL.md routes every Workflow 0..11 and entry 4A..4H through references` with:

```javascript
test("SKILL.md routes every v3 lifecycle phase through references", () => {
  const source = `${skill}\n${Object.values(refs).join("\n")}`;
  for (const marker of [
    "Requirements discovery",
    "Pre-Spec Context Gate",
    "PlanWeave Spec Canvas",
    "Spec Review Gate",
    "PlanWeave Implementation Canvas",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Figma Write Blocks",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(source.includes(marker), `missing lifecycle marker: ${marker}`);
  }
});
```

Replace the test named `SKILL.md / state-and-recovery.md mandate Read-Only guard for Workflow 6/8/10` with:

```javascript
test("SKILL.md / planning.md mandate read-only guards for Audit and Export", () => {
  const joined = skill + "\n" + refs.planning + "\n" + refs.state + "\n" + refs.execution;
  assert.match(joined, /Audit/);
  assert.match(joined, /Export/);
  assert.match(joined, /writeRequired=false/);
  assert.match(joined, /forbidden unless the user starts a new write-capable task|禁止.*write-capable task/);
});
```

- [ ] **Step 4: Run rewritten structural tests**

Run:

```bash
node figma-skill/tests/validate-skill.mjs
cd figma-skill && node --test tests/workflow-contract.test.mjs tests/naming-and-workflow.test.mjs tests/v3-skill-router.test.mjs tests/v3-planweave-planning.test.mjs tests/v3-runtime-refs.test.mjs
```

Expected: PASS. `validate-skill.mjs` prints the v3 PASS line. Node test files report 0 failures.

- [ ] **Step 5: Commit Task 5**

```bash
git add figma-skill/tests/validate-skill.mjs figma-skill/tests/workflow-contract.test.mjs figma-skill/tests/naming-and-workflow.test.mjs
git commit -m "test(figma-skill): update contracts for PlanWeave v3"
```

---

### Task 6: Update pressure-scenario documentation for v3 behavior

**Files:**
- Modify: `figma-skill/tests/scenarios.md`
- Modify: `figma-skill/tests/expected-behaviors.md`

**Interfaces:**
- Consumes: v3 runtime contract from Tasks 1–5.
- Produces: behavioral scenario docs that probe PlanWeave authority, Pre-Spec ordering, old-ledger refusal, and artifact boundaries.

- [ ] **Step 1: Update scenario markers in `scenarios.md`**

Make these exact replacements in `figma-skill/tests/scenarios.md`:

```text
Workflow 6 write plan approval → Plan Review Gate
Workflow 11 archive → Delivery Block and Final Review Gate
Workflow 12 self-reflection → Self-Reflection Block
.figma/tasks ledger → PlanWeave state authority
figma-task-state.mjs checkpoint → planweave submit-block / submit-review
```

Add this scenario block after the existing design-system scenario group:

```markdown
### S26 — Pre-Spec design-system read cannot be delayed

User asks for a new Figma screen and says "you can read the design system when implementing." Correct behavior: refuse to draft spec until `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md`, figma-cli environment facts, and required live Figma context are gathered. The implementation plan must not list design-system reading as its first exposure to the design system.

Expected: B

A. Write the implementation plan with Step 1 reading the design-system doc.
B. Complete Pre-Spec Context Gate first, then write the spec, then plan.
C. Skip the design system because the user gave permission.
```

Add this scenario block after old resume/recovery scenarios:

```markdown
### S27 — Old `.figma/tasks` record exists but PlanWeave has no current block

A previous ignored `.figma/tasks/<task-id>/` directory is present on disk. PlanWeave has no active package for the request. Correct behavior: treat the old ledger as non-authoritative, ask whether to import or create a PlanWeave package, and live-read Figma before any write.

Expected: B

A. Resume from old `state.json` and continue the recorded plan.
B. Use PlanWeave as state authority and live-read Figma before any write.
C. Delete the old directory without asking.
```

- [ ] **Step 2: Update `expected-behaviors.md` with v3 rules**

Add this section near the existing Figma workflow behavior list:

```markdown
## v3 PlanWeave behaviors

- Pre-Spec Context Gate happens before spec drafting. Design-system reads, figma-cli environment facts, and live Figma context are not implementation-plan steps.
- PlanWeave is the workflow authority. Old `.figma/tasks` records can be historical evidence only after user-approved import or explicit reference, never active state.
- `.figma/screenshot/<planweave-ref>/` stores visual evidence only.
- `.figma/feedback/<timestamp>.md` stores self-reflection only.
- Review gates return `pass` or `needs_changes`; `needs_changes` includes target block, reason, and required change.
- Read-only `Audit` and `Export` tasks do not mutate Figma.
```

- [ ] **Step 3: Run markdown contract tests**

Run:

```bash
node figma-skill/tests/validate-skill.mjs
cd figma-skill && node --test tests/v3-skill-router.test.mjs tests/v3-planweave-planning.test.mjs tests/v3-runtime-refs.test.mjs
```

Expected: PASS. The new scenario docs are not executable tests, but the runtime contract tests must remain green.

- [ ] **Step 4: Commit Task 6**

```bash
git add figma-skill/tests/scenarios.md figma-skill/tests/expected-behaviors.md
git commit -m "docs(figma-skill): update pressure scenarios for PlanWeave v3"
```

---

### Task 7: Full deterministic regression and results update

**Files:**
- Modify: `figma-skill/tests/green-results.md`
- Modify: `figma-skill/tests/v2-green-results.md`

**Interfaces:**
- Consumes: all v3 docs/tests/deletions from Tasks 1–6.
- Produces: recorded deterministic evidence for the v3 migration.

- [ ] **Step 1: Run full Node test suite**

Run:

```bash
cd figma-skill && node --test tests/*.test.mjs
```

Expected: PASS. The exact count is whatever Node reports after deleting ledger-only tests and adding v3 tests; record the count in `green-results.md`.

- [ ] **Step 2: Run structural validator**

Run from repository root:

```bash
node figma-skill/tests/validate-skill.mjs
```

Expected output includes:

```text
PASS: figma-skill v3 PlanWeave structure, references, preserved invariants, and old-ledger removal
```

- [ ] **Step 3: Run PowerShell installer tests**

Run:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
```

Expected: PASS from the PowerShell test harness.

- [ ] **Step 4: Run syntax checks for remaining scripts**

Run:

```bash
for f in figma-skill/scripts/*.mjs; do node --check "$f"; done
```

Expected: no output and exit code 0.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 6: Update `green-results.md`**

Append this section to `figma-skill/tests/green-results.md`. Use the short SHA from `git rev-parse --short HEAD` in the heading sentence, and copy the exact Node test pass count from Step 1 into the observed bullet:

```markdown
## v3.0 PlanWeave migration — 2026-07-16

Deterministic run at the current HEAD recorded during Task 7:

```bash
node figma-skill/tests/validate-skill.mjs
cd figma-skill && node --test tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
for f in figma-skill/scripts/*.mjs; do node --check "$f"; done
git diff --check
```

Observed:

- `validate-skill.mjs` → PASS.
- `node --test tests/*.test.mjs` → copy the exact pass count from Step 1, with 0 fail.
- PowerShell installer tests → PASS.
- `node --check` for remaining helper scripts → PASS.
- `git diff --check` → PASS.

Result: v3.0 runtime contract is structurally activated. PlanWeave is workflow authority; figma-cli remains Figma fact/write authority; old `.figma/tasks` ledger implementation and ledger-only tests are removed; screenshot and feedback artifacts remain.
```

- [ ] **Step 7: Update `v2-green-results.md` with forward pointer**

Append:

```markdown
## Forward pointer — v3.0 PlanWeave migration

v2 behavioral evidence remains historical. v3.0 replaces the `.figma/tasks` ledger with PlanWeave authority and removes task-state implementation/tests. See `tests/green-results.md` section "v3.0 PlanWeave migration — 2026-07-16" for the deterministic v3 run.
```

- [ ] **Step 8: Commit Task 7**

```bash
git add figma-skill/tests/green-results.md figma-skill/tests/v2-green-results.md
git commit -m "test(figma-skill): record v3 PlanWeave green run"
```

---

### Task 8: Final repository verification and push

**Files:**
- No planned file edits.

**Interfaces:**
- Consumes: committed Tasks 1–7.
- Produces: clean working tree except pre-existing ignored/untracked local artifacts, pushed `origin main`, and hook-triggered skill sync.

- [ ] **Step 1: Verify no old ledger files remain**

Run:

```bash
test ! -e figma-skill/scripts/figma-task-state.mjs
test ! -d figma-skill/scripts/lib/task-state
test ! -e figma-skill/schemas/task-state.schema.json
test ! -e figma-skill/schemas/event.schema.json
test ! -e figma-skill/schemas/index.schema.json
test ! -e figma-skill/schemas/config.schema.json
```

Expected: no output and exit code 0.

- [ ] **Step 2: Verify runtime docs do not teach old active ledger commands**

Run:

```bash
if git grep -nE "figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate|archive|close|reflect)|\.figma/tasks/<task-id>/|state\.validation\.visual\.summary|archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)|lease\.json|events\.jsonl" -- figma-skill/SKILL.md figma-skill/references figma-skill/scripts/README.md; then
  exit 1
fi
```

Expected: no matches and exit code 0.

- [ ] **Step 3: Run final deterministic suite**

Run:

```bash
node figma-skill/tests/validate-skill.mjs
cd figma-skill && node --test tests/*.test.mjs
```

Expected: both commands pass.

- [ ] **Step 4: Check working tree**

Run:

```bash
git status --short
```

Expected: no tracked modifications. A pre-existing untracked `.figma/` directory may appear and must not be committed.

- [ ] **Step 5: Push**

Run:

```bash
git push origin main
```

Expected: push succeeds. The project hook runs `node sync-skills.mjs --only-changed -v` after the successful Claude Code `Bash` push.

---

## Self-Review

### Spec coverage

- Decision Summary and Goals → Tasks 1–5 define PlanWeave authority, figma-cli authority, artifact boundary, old-ledger removal, and v3 version.
- Pre-Spec Context Gate → Tasks 1–2 update SKILL, planning, and design-system docs; tests assert design-system, environment, and live facts happen before spec.
- Spec Gate → Task 2 planning doc defines spec contents and forbidden command-sequence contents.
- PlanWeave Package Shape → Task 2 planning doc defines Spec Canvas, Implementation Canvas, and required blocks.
- Fixed Final Blocks → Task 2 planning doc and tests assert Plan Review failure on missing final blocks.
- Review-Gate Contract → Tasks 1–2 and Task 5 tests assert `pass | needs_changes`, `targetBlock`, `reason`, `requiredChange`.
- Reference Refactor Plan → Tasks 1–3 rewrite all runtime references.
- Deletion Scope → Task 4 deletes implementation, schemas, and ledger-only tests.
- Test Strategy → Tasks 1–7 use red/green tests, preserve helper tests, and record final evidence.
- Failure and Recovery Semantics → Tasks 2–3 route failures through PlanWeave blocks and PlanWeave recovery.
- Acceptance Criteria → Tasks 1–8 cover docs, deletion, tests, version `3.0`, commit, and push.

### Placeholder scan

This plan avoids unresolved implementation placeholders and vague steps. The only dynamic values are final verification observations in Task 7, where the executor must copy the actual SHA/pass count from commands run immediately beforehand.

### Type and name consistency

- Test file names are consistent across tasks: `v3-skill-router.test.mjs`, `v3-planweave-planning.test.mjs`, `v3-runtime-refs.test.mjs`.
- Artifact path is consistently `.figma/screenshot/<planweave-ref>/` and `.figma/feedback/<timestamp>.md`.
- Review shape consistently uses `result`, `targetBlock`, `reason`, and `requiredChange`.
- PlanWeave lifecycle block names are consistent across SKILL, planning reference, runtime tests, and workflow contract tests.
