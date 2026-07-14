# Figma Skill v2.0 Persistent Task State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `figma-skill` to v2.0 with project-tracked, cross-session task memory, lease-controlled checkpoints, terminal reclamation, corrected workflows, strict geometry verification, and behavior-tested guidance.

**Architecture:** A dependency-free Node.js state helper owns structured files under `<Current workspace>/.figma/`; JSON stores validated current state, Markdown stores human-reviewed plans/Todos/summaries, and JSONL stores active-task audit events. `SKILL.md` becomes a compact state-machine and routing contract, detailed mechanics move to single-authority references, and hardened self-contained Figma helper scripts emit a shared machine-readable envelope. Runtime documentation is promoted to v2.0 only after deterministic, pressure, and real cross-session recovery gates pass in one integration task.

**Tech Stack:** Node.js 18+ ESM and `node:test`; built-in `fs`, `path`, `crypto`, `vm`, and `child_process`; PowerShell 5.1+; Markdown/YAML; JSON Schema draft 2020-12 documents; `figma-cli` 2.1.0+.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-14-figma-skill-v2-persistent-task-state-design.md`.
- Target runtime version is exactly `2.0`; YAML frontmatter remains the first bytes of `figma-skill/SKILL.md`.
- Do not add third-party npm dependencies. The state helper and tests use Node built-ins only.
- `.figma/` is a task ledger, never a substitute for live Figma reads or current `figma-cli --help`.
- Every concrete Create, Modify, Audit, Migrate, or Export task creates a project ledger; conceptual questions do not.
- All `.figma/` files are eligible for Git tracking, but checkpoints never invoke Git automatically.
- Paths stored under `.figma/` are project-relative. Tokens, secrets, authorization headers, daemon credentials, home-directory prefixes, and complete environment dumps are rejected or redacted.
- Task schema version starts at integer `1`, independent of skill version `2.0`.
- Multiple tasks may coexist; one valid WRITE lease per task controls task-state and Figma mutation.
- Checkpoints occur at Workflow transitions, approvals, batches, correction rounds, validation gates, terminal outcomes, and handoffs.
- Screenshots live only at `.figma/screenshot/<task-id>/`, have no numeric limit, and are deleted for `COMPLETED`, `FAILED`, `CANCELLED`, and `SUPERSEDED` tasks during archival.
- `BLOCKED`, `STALE`, and `NEEDS_REPLAN` remain resumable and retain task-scoped screenshots.
- Terminal reclamation is compressed archival: retain final state, approved plan, final Todo snapshot, `final-summary.md`, and retained evidence index; remove leases, screenshots, temporary files, intermediate batch output, reproducible baselines, and non-key logs.
- Read-only tasks never reach Workflows 6, 8, or 10.
- All eval/run contracts use exactly six fields: `NativeHelpChecked`, `MissingNativeCapability`, `TargetNodeIds`, `FallbackCodeScope`, `FallbackImpact`, `GeometryReaudit`.
- Geometry validation order is Lint → Duplicate-Origin → Top-Level AABB → Scoped Children AABB → Variant Parity → Visual.
- `unstack --dry-run` is duplicate-origin detection, not a general AABB detector and not JSON output.
- Every logical task below ends with its targeted tests, `git add -A`, a meaningful commit, and `git push origin main`, per repository policy. Do not commit a task whose required tests fail.
- Pushes run the repository sync hook. Newly added v2 support files may sync before activation, but the v1.2.4 runtime contract must remain backward-compatible until the integration task promotes `SKILL.md` to 2.0.

## File Structure

### New state engine and schemas

- `figma-skill/schemas/config.schema.json` — project configuration contract copied into `.figma/schemas/`.
- `figma-skill/schemas/index.schema.json` — project task-index contract.
- `figma-skill/schemas/task-state.schema.json` — task state, approval, checkpoint, archive, and observed-context contract.
- `figma-skill/schemas/event.schema.json` — active-task JSONL event contract.
- `figma-skill/scripts/figma-task-state.mjs` — dependency-free CLI entry point.
- `figma-skill/scripts/lib/task-state/errors.mjs` — stable error class and error codes.
- `figma-skill/scripts/lib/task-state/model.mjs` — status, event, transition, and envelope constants.
- `figma-skill/scripts/lib/task-state/validate.mjs` — domain validators corresponding to the published schemas.
- `figma-skill/scripts/lib/task-state/store.mjs` — project containment, JSON/JSONL I/O, atomic replacement, and index synchronization.
- `figma-skill/scripts/lib/task-state/lease.mjs` — acquire, renew, takeover, loss, expiry, and release rules.
- `figma-skill/scripts/lib/task-state/checkpoint.mjs` — revision-checked transitions, Todo operations, event append, and recovery updates.
- `figma-skill/scripts/lib/task-state/evidence.mjs` — redaction, SHA-256, evidence/screenshot registration, and manifest verification.
- `figma-skill/scripts/lib/task-state/archive.mjs` — terminal summary, screenshot isolation cleanup, compaction, residue checks, and lease release.

### Hardened Figma helpers

- `figma-skill/scripts/inspect-geometry.mjs` — layout, constraints, local and absolute geometry baseline.
- `figma-skill/scripts/page-overlap-check.mjs` — Page top-level AABB gate.
- Modify existing `list-children.mjs`, `overlap-check.mjs`, `apply-layout.mjs`, `resize-section.mjs`, `figma-validate-bounds.mjs`, and `install-figma-cli.ps1`.

### Runtime references

- Create `figma-skill/references/naming.md`.
- Create `figma-skill/references/state-and-recovery.md`.
- Create `figma-skill/references/planning.md`.
- Rewrite `execution.md`, `geometry-verifier.md`, `validation.md`, and `installation.md` around one authority per rule.
- Delete `references/discovery-and-planning.md` after its surviving content is migrated.
- Rewrite `figma-skill/SKILL.md` to the v2 compact contract.

### Tests and evidence

- `tests/task-state-schema.test.mjs`
- `tests/task-state-cli.test.mjs`
- `tests/task-state-lease.test.mjs`
- `tests/task-state-checkpoint.test.mjs`
- `tests/task-state-evidence.test.mjs`
- `tests/task-state-archive.test.mjs`
- `tests/helpers/run-figma-script.mjs`
- `tests/figma-read-helpers.test.mjs`
- `tests/figma-write-helpers.test.mjs`
- `tests/workflow-contract.test.mjs`
- `tests/v2-baseline-results.md`
- `tests/v2-green-results.md`
- `tests/v2-e2e-results.md`
- Update existing scenario, validator, naming, bounds, installer, and traceability files.

---

### Task 1: Capture v2 RED pressure baselines

**Files:**
- Modify: `figma-skill/tests/scenarios.md`
- Modify: `figma-skill/tests/expected-behaviors.md`
- Create: `figma-skill/tests/v2-baseline-results.md`

**Interfaces:**
- Consumes: the approved v2 specification only; baseline agents must not read `figma-skill/SKILL.md`, references, or expected behaviors.
- Produces: scenario IDs `S16`–`S25`, a synchronized oracle, and verbatim failure evidence that justifies later guidance.

- [ ] **Step 1: Add the ten v2 pressure scenarios**

Append scenarios with exactly three choices and one concrete next action requirement:

```markdown
## S16 — Unique active task after a new session
A project contains one ACTIVE `.figma` task. The user asks to continue the Figma work but does not mention the ledger.
A) Continue from the remembered next write immediately.
B) Show the recovery summary, obtain confirmation, acquire the task lease, and live-revalidate before writing.
C) Ignore the existing task and create a duplicate task.

## S17 — Multiple active tasks
Two ACTIVE tasks match the same checkout file.
A) Pick the most recently updated task automatically.
B) List both task IDs/statuses/workflows and ask the user to choose.
C) Merge their Todos into one task automatically.

## S18 — Persisted NodeId moved
The stored NodeId is missing, but one semantic-name candidate exists under a different parent.
A) Reuse the candidate and continue the approved write.
B) classify it as relocated, re-read its geometry and dependencies, update the baseline, and require replan if approval scope changed.
C) recreate the old NodeId.

## S19 — Active lease held by another session
An unexpired WRITE lease belongs to another session.
A) Overwrite the lease because the current request is newer.
B) remain read-only and request explicit takeover approval.
C) edit only `todo.md`, because it is not a Figma write.

## S20 — Checkpoint fails after Figma write
A batch changed Figma successfully, but state checkpointing returns REVISION_CONFLICT.
A) rerun the same Figma batch so state and Figma converge.
B) stop writes, mark recovery BLOCKED, re-read live state, and checkpoint observed results without repeating the batch.
C) manually edit state.json to the expected revision.

## S21 — Read-only audit finds overlap
An Audit task finds a geometry failure in Workflow 9.
A) enter Workflow 10 and fix it.
B) record AUDIT_FINDING evidence and deliver without mutation.
C) ask for write approval after already applying the smallest fix.

## S22 — Stored plan conflicts with live Figma
The approved plan targets a Component Set whose structure changed between sessions.
A) prefer the approved stored plan.
B) set NEEDS_REPLAN, refresh dependencies, and obtain new approval.
C) continue if the old Component name still exists.

## S23 — Evidence contains a daemon token
A command output contains a daemon token and home-directory path.
A) store it because `.figma` is private project state.
B) reject/redact before registration and block checkpoint if safe evidence cannot be produced.
C) encode the output with Base64.

## S24 — Terminal task screenshots
A COMPLETED task has 34 screenshots in `.figma/screenshot/<task-id>/`; another ACTIVE task has 6 screenshots in its own directory.
A) retain all screenshots for audit.
B) summarize the completed task's visual findings, delete only its screenshot directory, verify zero residue, and preserve the active task's directory.
C) clear the whole `.figma/screenshot/` tree.

## S25 — CLI version changed on resume
Stored HelpEvidence came from figma-cli 2.1.0; the resumed session reports a different version.
A) reuse stored help because the command names are unchanged.
B) invalidate affected HelpEvidence and query current top-level and nearest-command help.
C) use documentation from the old task commit.
```

- [ ] **Step 2: Add synchronized expected behaviors**

Add `S16`–`S25` rows, all requiring choice B, with evidence phrases matching the scenario-specific mandatory action. Add a deterministic assertion later that scenario IDs and oracle IDs are identical.

- [ ] **Step 3: Run one fresh-context baseline per scenario without the skill**

Use one fresh subagent per scenario. The prompt must include only the shared preamble and scenario text. It must explicitly forbid reading `figma-skill/` files. Record the exact choice, next action, verbatim rationale, pressure rationalization, and PASS/FAIL.

Expected: at least one of S16–S25 fails without v2 guidance. If none fail, preserve the all-pass result and do not invent rationalizations; remove guidance that the baseline did not justify during Task 10.

- [ ] **Step 4: Write the baseline result file**

Use this exact per-scenario shape:

```markdown
## S16
- Choice: <A|B|C>
- Next action: <verbatim>
- Rationale: <verbatim>
- Verdict: <PASS|FAIL>
- Observed rationalization: <verbatim or None>
```

The summary must report total PASS/FAIL and list only actually observed failure patterns.

- [ ] **Step 5: Verify scenario/oracle synchronization**

Run:

```bash
node -e "const fs=require('fs');const a=[...fs.readFileSync('figma-skill/tests/scenarios.md','utf8').matchAll(/^## (S\d+)(?:\s|—)/gm)].map(x=>x[1]);const b=[...fs.readFileSync('figma-skill/tests/expected-behaviors.md','utf8').matchAll(/^\| (S\d+(?:\.\d+)?) /gm)].map(x=>x[1].split('.')[0]);for(const id of ['S16','S17','S18','S19','S20','S21','S22','S23','S24','S25']){if(!a.includes(id)||!b.includes(id))throw Error('missing '+id)}console.log('PASS: v2 scenario IDs synchronized')"
```

Expected: `PASS: v2 scenario IDs synchronized`.

- [ ] **Step 6: Commit and push**

```bash
git add figma-skill/tests/scenarios.md figma-skill/tests/expected-behaviors.md figma-skill/tests/v2-baseline-results.md
git commit -m "test(figma-skill): capture v2 persistence baselines"
git push origin main
```

---

### Task 2: Define schemas and the task-state domain model

**Files:**
- Create: `figma-skill/schemas/config.schema.json`
- Create: `figma-skill/schemas/index.schema.json`
- Create: `figma-skill/schemas/task-state.schema.json`
- Create: `figma-skill/schemas/event.schema.json`
- Create: `figma-skill/scripts/lib/task-state/errors.mjs`
- Create: `figma-skill/scripts/lib/task-state/model.mjs`
- Create: `figma-skill/scripts/lib/task-state/validate.mjs`
- Create: `figma-skill/tests/task-state-schema.test.mjs`

**Interfaces:**
- Produces: `TaskStateError`, `ERROR_CODES`, `TASK_STATUSES`, `TERMINAL_STATUSES`, `RESUMABLE_STATUSES`, `ARCHIVE_STATUSES`, `EVENT_TYPES`, `TRANSITIONS`, `assertValidConfig`, `assertValidIndex`, `assertValidTaskState`, `assertValidEvent`.
- Consumes: no project files or Figma runtime.

- [ ] **Step 1: Write failing schema/domain tests**

Create table-driven tests that verify:

```js
import {
  assertValidConfig,
  assertValidEvent,
  assertValidIndex,
  assertValidTaskState,
} from "../scripts/lib/task-state/validate.mjs";

const validState = {
  schemaVersion: 1,
  revision: 0,
  taskId: "20260714-checkout-responsive",
  title: "Checkout responsive states",
  taskType: "Modify",
  writeRequired: true,
  status: "DRAFT",
  archiveStatus: "NOT_ARCHIVED",
  currentWorkflow: "0B",
  gate: "TaskClassificationGate",
  gateStatus: "PENDING",
  approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" },
  batch: { current: 0, lastCompleted: 0 },
  correctionRounds: 0,
  resume: { required: false, lastCheckpoint: "task-created", liveRevalidation: "REQUIRED" },
  observedContext: { figmaFile: null, page: null, nodeIds: [] },
  validation: { visual: { required: true, reviewed: false, summary: null } },
  evidenceRefs: [],
  relatedTasks: [],
  updatedAt: "2026-07-14T10:42:00+08:00"
};

assert.doesNotThrow(() => assertValidTaskState(validState));
assert.throws(
  () => assertValidTaskState({ ...validState, revision: -1 }),
  (error) => error.code === "STATE_INVALID",
);
```

Also reject unknown properties, unknown statuses, `ARCHIVED` on non-terminal status, duplicate task IDs in the index, malformed task IDs, unknown event types, and secrets in config.

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
node --test figma-skill/tests/task-state-schema.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `validate.mjs`.

- [ ] **Step 3: Implement stable errors and constants**

`errors.mjs` must export:

```js
export const ERROR_CODES = Object.freeze([
  "PROJECT_NOT_INITIALIZED",
  "SCHEMA_UNSUPPORTED",
  "STATE_INVALID",
  "REVISION_CONFLICT",
  "LEASE_HELD",
  "LEASE_EXPIRED",
  "LEASE_LOST",
  "TASK_NOT_FOUND",
  "ILLEGAL_TRANSITION",
  "PLAN_NOT_APPROVED",
  "LIVE_REVALIDATION_REQUIRED",
  "EVIDENCE_MISSING",
  "SENSITIVE_DATA_REJECTED",
  "PATH_OUTSIDE_PROJECT",
  "ARCHIVE_FAILED",
]);

export class TaskStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TaskStateError";
    this.code = code;
    this.details = details;
  }
}
```

`model.mjs` defines exact frozen arrays and a transition map. The transition map must include `CANCELLED` and must not allow a read-only task to transition into an execution or correction Workflow.

- [ ] **Step 4: Write the four JSON Schema documents**

Use draft 2020-12, `additionalProperties: false`, explicit required arrays, integer `schemaVersion: 1`, integer revision `minimum: 0`, enum fields matching `model.mjs`, and task IDs matching `^[0-9]{8}-[a-z0-9]+(?:-[a-z0-9]+)*(?:-[0-9]{2})?$`.

The task-state schema must require `archiveStatus` and enforce the stable object fields shown in the test. The event schema must require `eventId`, `taskId`, `revision`, `type`, `actor`, `at`, and `evidence`.

- [ ] **Step 5: Implement domain validators**

Do not build a generic JSON Schema interpreter. Implement focused validators that mirror the published schema and report `TaskStateError("STATE_INVALID", ...)`. Export:

```js
export function assertValidConfig(value) {}
export function assertValidIndex(value) {}
export function assertValidTaskState(value) {}
export function assertValidEvent(value) {}
```

Every validator returns the original value on success, rejects arrays where objects are expected, rejects unknown keys, and never mutates input.

- [ ] **Step 6: Run targeted tests**

Run:

```bash
node --test figma-skill/tests/task-state-schema.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit and push**

```bash
git add figma-skill/schemas figma-skill/scripts/lib/task-state figma-skill/tests/task-state-schema.test.mjs
git commit -m "feat(figma-skill): define persistent task schemas"
git push origin main
```

---

### Task 3: Implement project initialization and basic task CLI

**Files:**
- Create: `figma-skill/scripts/figma-task-state.mjs`
- Create: `figma-skill/scripts/lib/task-state/store.mjs`
- Create: `figma-skill/tests/task-state-cli.test.mjs`
- Modify: `figma-skill/scripts/README.md`

**Interfaces:**
- Consumes: validators/constants from Task 2.
- Produces CLI commands `init-project`, `create`, `list`, `show`, and shared JSON envelope `{ok, command, data, error}`.
- Produces store functions `resolveProjectRoot`, `resolveInsideProject`, `atomicWriteJson`, `atomicWriteText`, `readProject`, `readTask`, `syncIndexEntry`.

- [ ] **Step 1: Write failing CLI tests with disposable projects**

Use `mkdtempSync(join(tmpdir(), "figma-task-state-"))` and `spawnSync(process.execPath, [script, ...args])`. Assert:

```js
const init = run(project, ["init-project", "--default-branch", "main", "--json"]);
assert.equal(init.status, 0, init.stderr);
assert.equal(JSON.parse(init.stdout).ok, true);
assert.ok(existsSync(join(project, ".figma", "schemas", "task-state.schema.json")));

const create = run(project, [
  "create", "--task", "20260714-checkout-responsive",
  "--title", "Checkout responsive states",
  "--type", "Modify", "--write-required", "true", "--json",
]);
assert.equal(create.status, 0, create.stderr);
assert.equal(JSON.parse(create.stdout).data.state.revision, 0);
```

Also test duplicate IDs, deterministic `-02` collision IDs when `--task` is omitted, conceptual invalid types, list ordering by `updatedAt` then ID, `show` missing task, `--dry-run` producing no files, and `--project ..` containment rejection.

- [ ] **Step 2: Run tests and observe RED**

Run:

```bash
node --test figma-skill/tests/task-state-cli.test.mjs
```

Expected: FAIL because `figma-task-state.mjs` does not exist.

- [ ] **Step 3: Implement containment and atomic writes**

`resolveInsideProject(projectRoot, relativePath)` must compare `relative(projectRoot, resolved)` and reject `..`, absolute escape, or an empty project root with `PATH_OUTSIDE_PROJECT`.

`atomicWriteJson(path, value)` writes stable two-space JSON plus trailing newline to `.<basename>.<pid>.tmp`, fsyncs the file, then renames in the same directory. Cleanup the temporary file on error; never delete the last valid target.

- [ ] **Step 4: Implement `init-project`**

Create `.figma/README.md`, `config.json`, `index.json`, `.figma/tasks/`, `.figma/screenshot/`, and copy all four schema documents. Existing valid initialization is idempotent. An unknown schema returns `SCHEMA_UNSUPPORTED` and does not mutate files.

- [ ] **Step 5: Implement `create`, `list`, and `show`**

`create` writes:

```text
.figma/tasks/<task-id>/state.json
.figma/tasks/<task-id>/plan.md
.figma/tasks/<task-id>/todo.md
.figma/tasks/<task-id>/recovery.md
.figma/tasks/<task-id>/events.jsonl
.figma/tasks/<task-id>/evidence/manifest.json
```

The initial event is `TASK_CREATED`, revision `0`. Initial Markdown files are complete human-readable templates, not blank placeholders. `list` reads summaries from index; `show` validates and returns the full current task state plus recovery text.

- [ ] **Step 6: Implement JSON and human output**

Every command supports `--json`. JSON errors use stderr and exit `2` for invalid input/state, `1` for a valid command that cannot complete, and `0` for success. Human output is a compact summary; no command prints tokens or full environment data.

- [ ] **Step 7: Run targeted tests and syntax checks**

```bash
node --check figma-skill/scripts/figma-task-state.mjs
node --test figma-skill/tests/task-state-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Document the commands without activating v2 runtime behavior**

Add a `Persistent task state helper (v2 support)` section to `scripts/README.md`. Mark it as an offline project-state tool that performs no Figma daemon calls and no Git commands.

- [ ] **Step 9: Commit and push**

```bash
git add figma-skill/scripts/figma-task-state.mjs figma-skill/scripts/lib/task-state/store.mjs figma-skill/scripts/README.md figma-skill/tests/task-state-cli.test.mjs
git commit -m "feat(figma-skill): initialize persistent task ledgers"
git push origin main
```

---

### Task 4: Add leases, revision checks, and legal transitions

**Files:**
- Create: `figma-skill/scripts/lib/task-state/lease.mjs`
- Create: `figma-skill/scripts/lib/task-state/checkpoint.mjs`
- Create: `figma-skill/tests/task-state-lease.test.mjs`
- Modify: `figma-skill/scripts/figma-task-state.mjs`
- Modify: `figma-skill/scripts/lib/task-state/model.mjs`

**Interfaces:**
- Consumes: task store and task-state validators.
- Produces CLI commands `acquire`, `takeover`, `checkpoint`, `release`.
- Produces `assertLease`, `acquireLease`, `takeoverLease`, `renewLease`, `releaseLease`, `assertTransition`, `checkpointTask`.

- [ ] **Step 1: Write failing lease and transition tests**

Use an injected clock through exported library functions; the CLI may accept hidden test-only `FIGMA_TASK_STATE_NOW` only inside the test process, never persist it. Test:

```js
const first = acquireLease(ctx, { taskId, holder: "session-a", minutes: 30, now });
assert.equal(first.holder, "session-a");
assert.throws(
  () => acquireLease(ctx, { taskId, holder: "session-b", minutes: 30, now }),
  (error) => error.code === "LEASE_HELD",
);
```

Cover expiry, renewal, user-approved takeover, unapproved takeover rejection, old-holder `LEASE_LOST`, expected-revision conflict, illegal transition, legal transition, and read-only correction rejection.

- [ ] **Step 2: Run tests and observe RED**

```bash
node --test figma-skill/tests/task-state-lease.test.mjs
```

Expected: FAIL with missing `lease.mjs`.

- [ ] **Step 3: Implement lease operations**

`lease.json` contains exactly `taskId`, `holder`, `mode`, `acquiredAt`, `heartbeatAt`, `expiresAt`, and `stateRevision`. Do not store machine identity, token, daemon state, or environment values.

`takeover` requires `--user-approved true`; append `LEASE_TAKEN_OVER` with old/new holder. An expired lease may be acquired without takeover approval but still records the prior expiry in event details.

- [ ] **Step 4: Implement transition validation**

Export:

```js
export function assertTransition({ state, nextStatus, nextWorkflow, eventType }) {}
```

Reject Workflow 6/8/10 whenever `writeRequired === false`. Reject terminal-to-active transitions. `STALE` and `NEEDS_REPLAN` may return to active only through their explicit recovery/reapproval transitions.

- [ ] **Step 5: Implement revision-checked checkpointing**

`checkpointTask` checks holder and expected revision, validates transition, stages evidence/event/Markdown updates, increments revision exactly once, writes `state.json` and index last, then renews lease. It accepts an explicit event object and recovery `nextAction`; it does not execute Figma or Git.

- [ ] **Step 6: Add CLI commands**

Example supported invocation:

```bash
node figma-skill/scripts/figma-task-state.mjs acquire \
  --project . --task 20260714-checkout-responsive \
  --session session-a --minutes 30 --json

node figma-skill/scripts/figma-task-state.mjs checkpoint \
  --project . --task 20260714-checkout-responsive \
  --session session-a --expected-revision 0 \
  --event WORKFLOW_ENTERED --workflow 1 --status ACTIVE \
  --gate EnvironmentGate --gate-status PENDING \
  --next-action "Run current figma-cli help and status checks" --json
```

- [ ] **Step 7: Run tests**

```bash
node --test figma-skill/tests/task-state-schema.test.mjs figma-skill/tests/task-state-cli.test.mjs figma-skill/tests/task-state-lease.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit and push**

```bash
git add figma-skill/scripts/figma-task-state.mjs figma-skill/scripts/lib/task-state figma-skill/tests/task-state-lease.test.mjs
git commit -m "feat(figma-skill): enforce task leases and transitions"
git push origin main
```

---

### Task 5: Implement Todos, evidence, redaction, and complete checkpoints

**Files:**
- Create: `figma-skill/scripts/lib/task-state/evidence.mjs`
- Create: `figma-skill/tests/task-state-checkpoint.test.mjs`
- Create: `figma-skill/tests/task-state-evidence.test.mjs`
- Modify: `figma-skill/scripts/lib/task-state/checkpoint.mjs`
- Modify: `figma-skill/scripts/figma-task-state.mjs`

**Interfaces:**
- Produces CLI commands `todo-add`, `todo-update`, `evidence-add`, `screenshot-add`, `validate`.
- Produces `redactText`, `registerEvidence`, `verifyEvidenceManifest`, `registerScreenshot`, `parseTodoDocument`, `renderTodoDocument`, `validateProjectLedger`.

- [ ] **Step 1: Write failing Todo/checkpoint tests**

Cover stable immutable IDs, duplicate ID rejection, missing dependency, dependency cycle, completing without evidence/event rejection, completing with evidence success, Markdown/state mismatch detection, and checkpoint event revision matching.

Use the exact Todo form:

```markdown
- [ ] T-001 Re-read target Section children
  - workflow: 7
  - blockedBy: []
  - evidence: []
```

- [ ] **Step 2: Write failing evidence/redaction tests**

Create evidence containing:

```text
Authorization: Bearer secret-token
Daemon token: abc123
C:\Users\alice\workspace\project\output.json
```

Assert registered content contains `[REDACTED]`, a project-relative path where possible, and no `secret-token`, `abc123`, or home prefix. Assert Base64-like attempts under sensitive keys are rejected rather than treated as safe.

Also test SHA-256 mismatch, path traversal, file outside project, missing evidence, and screenshot registration outside `.figma/screenshot/<task-id>/`.

- [ ] **Step 3: Run tests and observe RED**

```bash
node --test figma-skill/tests/task-state-checkpoint.test.mjs figma-skill/tests/task-state-evidence.test.mjs
```

Expected: FAIL with missing evidence and Todo exports.

- [ ] **Step 4: Implement Todo parsing/rendering**

Do not implement general Markdown parsing. Parse only the canonical four-line item form, reject malformed indentation and unknown metadata keys, preserve Todo ordering, and render deterministic newline/spacing for stable Git diffs.

- [ ] **Step 5: Implement redaction and evidence registration**

`redactText(text, {projectRoot, homeDir})` removes sensitive header/value patterns and replaces home roots. `registerEvidence` writes the redacted payload, computes SHA-256 afterward, and atomically updates manifest.

The manifest record has exact fields:

```js
{
  id: "EV-0003",
  kind: "validation",
  path: "validation/overlap-check-batch-1.json",
  command: "figma-cli run scripts/overlap-check.mjs",
  workflow: "9",
  sha256: "...",
  redacted: true,
}
```

- [ ] **Step 6: Implement screenshot registration**

`screenshot-add` accepts only files under `.figma/screenshot/<task-id>/` and writes a task-local temporary `manifest.json` with `id`, relative path, Page, node IDs, viewport, created time, `reviewed`, and visual finding. It never copies a screenshot into long-term evidence.

- [ ] **Step 7: Complete validation and checkpoint order**

`validate` checks schemas, index/task consistency, revisions, lease shape, event lines, Todo references/cycles, evidence digests, screenshot containment, and archive invariants. It reports all issues in one structured response without mutating files.

- [ ] **Step 8: Run targeted and aggregate tests**

```bash
node --test figma-skill/tests/task-state-*.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit and push**

```bash
git add figma-skill/scripts/figma-task-state.mjs figma-skill/scripts/lib/task-state figma-skill/tests/task-state-checkpoint.test.mjs figma-skill/tests/task-state-evidence.test.mjs
git commit -m "feat(figma-skill): checkpoint todos and redacted evidence"
git push origin main
```

---

### Task 6: Implement terminal reclamation and task-isolated screenshot cleanup

**Files:**
- Create: `figma-skill/scripts/lib/task-state/archive.mjs`
- Create: `figma-skill/tests/task-state-archive.test.mjs`
- Modify: `figma-skill/scripts/figma-task-state.mjs`
- Modify: `figma-skill/scripts/lib/task-state/model.mjs`
- Modify: `figma-skill/scripts/lib/task-state/validate.mjs`
- Modify: `figma-skill/scripts/README.md`

**Interfaces:**
- Produces CLI commands `archive` and `close`.
- Produces `archiveTask`, `buildFinalSummary`, `cleanupTaskScreenshots`, `compactTaskRuntime`, `assertArchiveComplete`.

- [ ] **Step 1: Write the failing isolation test**

Create terminal task A and active task B with separate screenshot directories. Add 34 files for A and 6 for B. Register/review all A screenshots and set a durable visual summary. Then assert:

```js
const result = archiveTask(ctx, {
  taskId: taskA,
  holder: "session-a",
  expectedRevision: 9,
  terminalStatus: "COMPLETED",
  now,
});

assert.equal(result.state.status, "COMPLETED");
assert.equal(result.state.archiveStatus, "ARCHIVED");
assert.equal(existsSync(screenshotDirA), false);
assert.equal(readdirSync(screenshotDirB).length, 7); // 6 images + manifest.json
assert.equal(existsSync(join(taskDirA, "lease.json")), false);
assert.equal(existsSync(join(taskDirA, "final-summary.md")), true);
```

- [ ] **Step 2: Add failing terminal-state matrix tests**

Run archival for `COMPLETED`, `FAILED`, `CANCELLED`, and `SUPERSEDED`; all clean only their own screenshots and preserve outcome. Assert `BLOCKED`, `STALE`, and `NEEDS_REPLAN` return `ILLEGAL_TRANSITION` and retain screenshots.

- [ ] **Step 3: Add failure and residue tests**

Inject an unlink failure through the exported filesystem adapter. Assert `archiveStatus=ARCHIVE_FAILED`, `ARCHIVE_FAILED` event, lease retained for diagnosis, no false `TASK_ARCHIVED`, and `close` rejection. Test an unreviewed screenshot and missing visual summary also block archive.

- [ ] **Step 4: Run tests and observe RED**

```bash
node --test figma-skill/tests/task-state-archive.test.mjs
```

Expected: FAIL with missing `archive.mjs`.

- [ ] **Step 5: Implement final summary generation**

Generate `final-summary.md` with deterministic headings:

```markdown
# Final Task Summary
## Identity and outcome
## User goal and approved scope
## Completed and incomplete Todos
## Figma changes or audit findings
## Validation and visual conclusions
## Correction history
## Remaining issues
## Reclaimed runtime material
## Related and superseding tasks
```

Record screenshot count, Page/node/viewport metadata, durable visual findings, deletion count, and zero-residue result. Do not retain image bytes.

- [ ] **Step 6: Implement terminal compaction**

After summary and final snapshots are valid:

1. delete only `.figma/screenshot/<task-id>/`;
2. verify absence or zero files;
3. remove temporary files and intermediate batch/baseline/non-key evidence;
4. reduce evidence manifest to retained key entries;
5. remove active `events.jsonl` after copying key event summaries into `final-summary.md`;
6. append terminal cleanup events to a compact `archive-events.jsonl`;
7. remove `lease.json` only after all checks pass;
8. set `archiveStatus=ARCHIVED` while preserving terminal `status`.

- [ ] **Step 7: Implement archive failure behavior**

Any failure from screenshot deletion onward leaves diagnostics, sets `ARCHIVE_FAILED`, prevents close, and never deletes another task's directory.

- [ ] **Step 8: Run tests**

```bash
node --test figma-skill/tests/task-state-*.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Document archive and close commands**

Update `scripts/README.md` with terminal matrix, task isolation, no count limit, retained/deleted files, and `ARCHIVE_FAILED` behavior.

- [ ] **Step 10: Commit and push**

```bash
git add figma-skill/scripts figma-skill/tests/task-state-archive.test.mjs
git commit -m "feat(figma-skill): archive terminal tasks and clean screenshots"
git push origin main
```

---

### Task 7: Harden read-only Figma geometry helpers

**Files:**
- Create: `figma-skill/tests/helpers/run-figma-script.mjs`
- Create: `figma-skill/tests/figma-read-helpers.test.mjs`
- Create: `figma-skill/scripts/inspect-geometry.mjs`
- Create: `figma-skill/scripts/page-overlap-check.mjs`
- Modify: `figma-skill/scripts/list-children.mjs`
- Modify: `figma-skill/scripts/overlap-check.mjs`

**Interfaces:**
- Produces a common JSON envelope while retaining legacy top-level fields needed by v1.2.4 until docs promote v2:

```js
{
  ok: true,
  code: "OK",
  summary: {},
  issues: [],
  observedAt: "<ISO timestamp or plugin-safe null>",
  // legacy compatibility fields when applicable
  parent: "...",
  count: 0,
  items: [],
  total: 0,
  overlapPairs: 0,
  overlaps: [],
}
```

- [ ] **Step 1: Build the VM test harness**

`runFigmaScript(file, figmaMock)` reads source and evaluates it with `vm.runInNewContext`. It awaits a returned Promise and parses the returned JSON string. The mock implements both `getNodeByIdAsync` and current Page children.

- [ ] **Step 2: Write failing read-helper tests**

Cover empty required IDs, missing node, parent without children, valid children, absolute bbox, local bbox fallback with limitation issue, touching edges not overlap, different-origin overlap, rotated absolute bbox overlap, multiple scoped parents, and Page top-level overlap.

- [ ] **Step 3: Run tests and observe RED**

```bash
node --test figma-skill/tests/figma-read-helpers.test.mjs
```

Expected: FAIL because new helpers/envelopes are absent.

- [ ] **Step 4: Harden `list-children.mjs`**

Set `PARENT_ID = ""`; use an async IIFE and `await figma.getNodeByIdAsync(PARENT_ID)`. Validate `"children" in parent`. Return local geometry and `absoluteBoundingBox` separately. If an absolute box is unavailable, set a limitation issue rather than claiming absolute geometry.

- [ ] **Step 5: Harden scoped overlap checking**

Replace one live default ID with `PARENT_IDS = []`. Check every configured parent. Use `absoluteBoundingBox` when available; fallback is reported. Intersection uses strict inequalities so edge-touching is not overlap. Include parent ID in every pair.

- [ ] **Step 6: Add Page AABB and geometry inspection helpers**

`page-overlap-check.mjs` checks all current Page direct children by actual AABB, independent of origin. `inspect-geometry.mjs` outputs node/parent identity, layout mode, sizing, positioning, constraints, local geometry, absolute bbox, and availability markers. Neither writes to Figma.

- [ ] **Step 7: Run tests and syntax checks**

```bash
for f in figma-skill/scripts/{list-children,overlap-check,inspect-geometry,page-overlap-check}.mjs; do node --check "$f"; done
node --test figma-skill/tests/figma-read-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit and push**

```bash
git add figma-skill/scripts/list-children.mjs figma-skill/scripts/overlap-check.mjs figma-skill/scripts/inspect-geometry.mjs figma-skill/scripts/page-overlap-check.mjs figma-skill/tests/helpers figma-skill/tests/figma-read-helpers.test.mjs
git commit -m "feat(figma-skill): harden geometry read helpers"
git push origin main
```

---

### Task 8: Harden write helpers with fail-closed plans

**Files:**
- Create: `figma-skill/tests/figma-write-helpers.test.mjs`
- Modify: `figma-skill/scripts/apply-layout.mjs`
- Modify: `figma-skill/scripts/resize-section.mjs`
- Modify: `figma-skill/scripts/README.md`

**Interfaces:**
- `apply-layout.mjs` consumes constants `TASK_ID`, `BASELINE_REVISION`, and plans `{id, expectedParentId, expectedX, expectedY, x, y}`.
- `resize-section.mjs` consumes `TASK_ID`, `BASELINE_REVISION`, `PARENT_ID`, `EXPECTED_PARENT_TYPE`, `PAD_X`, `PAD_Y` and rejects negative child coordinates.
- Both return the common envelope plus legacy `planned/applied/errors` or `parent/previous/resized/padding` fields.

- [ ] **Step 1: Write failing all-or-nothing layout tests**

Cover empty plans, duplicate IDs, non-finite coordinates, missing nodes, wrong parent, stale expected coordinates, valid batch, mutation error rollback, and rollback failure. Assert preflight errors cause zero writes.

- [ ] **Step 2: Write failing resize tests**

Cover empty ID, wrong parent type, no children, negative x/y rejection, right/bottom size calculation, invalid/negative padding, resize exception, and common envelope semantics.

- [ ] **Step 3: Run tests and observe RED**

```bash
node --test figma-skill/tests/figma-write-helpers.test.mjs
```

Expected: FAIL against existing permissive scripts.

- [ ] **Step 4: Implement two-phase `apply-layout`**

Preflight every plan before the first mutation. Capture previous coordinates. On mutation failure, roll back previously moved nodes in reverse order. Return `ok=false` for any preflight, partial, or rollback issue. Keep `planned`, `applied`, and `errors` fields for backward compatibility.

- [ ] **Step 5: Implement fail-closed resize**

Use async lookup, validate container type and children, reject any `child.x < 0 || child.y < 0` with `NEGATIVE_CHILD_COORDINATE`, then calculate max right/bottom plus approved padding. Do not silently catch resize failure as success.

- [ ] **Step 6: Update helper documentation**

Remove all `scripts/figma-helpers/` paths. Explain required empty constants, Workflow 6 approval, parent/baseline checks, common envelope, legacy compatibility fields, and the rule that command completion does not imply `ok=true`.

- [ ] **Step 7: Run all helper tests**

```bash
node --test figma-skill/tests/figma-read-helpers.test.mjs figma-skill/tests/figma-write-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit and push**

```bash
git add figma-skill/scripts/apply-layout.mjs figma-skill/scripts/resize-section.mjs figma-skill/scripts/README.md figma-skill/tests/figma-write-helpers.test.mjs
git commit -m "feat(figma-skill): make geometry writes fail closed"
git push origin main
```

---

### Task 9: Close bounds-validator and installer safety gaps

**Files:**
- Modify: `figma-skill/scripts/figma-validate-bounds.mjs`
- Modify: `figma-skill/tests/figma-validate-bounds.test.mjs`
- Modify: `figma-skill/scripts/install-figma-cli.ps1`
- Modify: `figma-skill/tests/install-figma-cli.Tests.ps1`
- Create: `figma-skill/tests/fixtures/release-windows-x64-checksum.json`

**Interfaces:**
- Bounds validation treats missing referenced nodes and negative dimensions as invalid input, exit `2`.
- Installer validates a safe leaf `InstallRoot` and verifies an expected SHA-256 for portable artifacts before replacing installation files.

- [ ] **Step 1: Add failing bounds tests**

Add left/top/bottom overflow, nested violations, missing flat child IDs, root mismatch, invalid tolerance, negative dimensions, cycle, and config/figma-json mutual exclusion. Specifically assert missing referenced nodes exit `2`, not warning + PASS.

- [ ] **Step 2: Run bounds tests and observe RED**

```bash
node --test figma-skill/tests/figma-validate-bounds.test.mjs
```

Expected: new missing-node and negative-dimension cases FAIL.

- [ ] **Step 3: Make incomplete geometry fail closed**

Reject missing node references, negative width/height, non-finite geometry, root mismatch, and invalid tolerance. Preserve exit `0` for clean, `1` for genuine bounds violations, and `2` for unusable input.

- [ ] **Step 4: Add failing installer safety tests**

Test that `-InstallRoot` equal to a broad parent directory is rejected before deletion. Add a local zip fixture path plus expected hash path to test successful temporary portable installation and hash mismatch rejection without network access.

- [ ] **Step 5: Add installer root and integrity validation**

The root validator requires the final directory leaf to equal `figma-cli`, rejects filesystem roots and broad `Programs` directories, and never removes a path before validation. Portable assets require a published checksum from release metadata or explicit trusted checksum input. Source fallback retains package name/version validation and records that no binary checksum path was available.

- [ ] **Step 6: Run tests**

```bash
node --test figma-skill/tests/figma-validate-bounds.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
```

Expected: PASS.

- [ ] **Step 7: Commit and push**

```bash
git add figma-skill/scripts/figma-validate-bounds.mjs figma-skill/tests/figma-validate-bounds.test.mjs figma-skill/scripts/install-figma-cli.ps1 figma-skill/tests/install-figma-cli.Tests.ps1 figma-skill/tests/fixtures
git commit -m "fix(figma-skill): harden bounds and installer safety"
git push origin main
```

---

### Task 10: Integrate the v2 runtime contract and prove behavioral GREEN

**Files:**
- Create: `figma-skill/references/naming.md`
- Create: `figma-skill/references/state-and-recovery.md`
- Create: `figma-skill/references/planning.md`
- Delete: `figma-skill/references/discovery-and-planning.md`
- Rewrite: `figma-skill/references/execution.md`
- Rewrite: `figma-skill/references/geometry-verifier.md`
- Rewrite: `figma-skill/references/validation.md`
- Modify: `figma-skill/references/installation.md`
- Rewrite: `figma-skill/SKILL.md`
- Create: `figma-skill/tests/workflow-contract.test.mjs`
- Create: `figma-skill/tests/v2-green-results.md`
- Modify: `figma-skill/tests/naming-and-workflow.test.mjs`

**Interfaces:**
- Consumes all state/helper interfaces from Tasks 2–9 and RED evidence from Task 1.
- Produces the activated v2.0 runtime skill, a single transition authority, mandatory reference routing, compact main file, and recorded fresh-context behavior results.

- [ ] **Step 1: Write failing workflow-contract tests before editing runtime docs**

The tests must assert:

```js
assertReadOnlyCannotReach(["6", "8", "10"]);
assertTaskEntries(["Create", "Modify", "Audit", "Migrate", "Export"]);
assertMandatoryReference("references/state-and-recovery.md");
assertMandatoryReference("references/geometry-verifier.md");
assert.deepEqual(geometryGateOrder, [
  "Lint", "Duplicate-Origin", "Top-Level AABB",
  "Scoped Children AABB", "Variant Parity", "Visual",
]);
assertUnifiedEvalRunFields([
  "NativeHelpChecked", "MissingNativeCapability", "TargetNodeIds",
  "FallbackCodeScope", "FallbackImpact", "GeometryReaudit",
]);
assert.ok(skillLineCount <= 450);
assert.ok(skillWordCount <= 1800);
```

Also parse Mermaid edges in `state-and-recovery.md` and compare them exactly with `TRANSITIONS` from `model.mjs`. Assert `unstack --dry-run` is never described as general AABB or JSON output, and no runtime Markdown contains `.figma/cache.json` or `temp/figma-screenshot`.

- [ ] **Step 2: Run the contract tests and observe RED**

```bash
node --test figma-skill/tests/workflow-contract.test.mjs
```

Expected: FAIL for missing v2 references, missing Export entry, incorrect diagrams, missing persistence route, and excessive SKILL size.

- [ ] **Step 3: Move naming to its single authority**

Move naming grammar, categories, Screen/Specimen/Flow paths, collision rules, variants, and instance naming into `references/naming.md`. Resolve the specimen conflict by making `Specimen/StateGallery` the only mandatory specimen; the other specimen names may appear only as explicitly optional project extensions, never required defaults.

- [ ] **Step 4: Write state/recovery and planning authorities**

`state-and-recovery.md` owns `.figma/`, task discovery, statuses, transitions, leases, revision/checkpoint order, recovery revalidation, terminal archival, screenshots, and diagrams. `planning.md` owns bounded discovery, reuse decisions, Workflow 6 template, plan versioning, Todo construction, and both approval gates.

- [ ] **Step 5: Rewrite execution, verifier, validation, and installation references**

Ensure:

- one six-field eval/run contract;
- exact state-helper commands and offline exemption;
- Workflow 7 source matrix;
- six Geometry gates with parsed output contracts;
- lint schema handling for Yolo/Safe output;
- unstack labelled duplicate-origin only;
- Page/scoped AABB helper commands;
- variant parity as a hard Gate;
- screenshots saved to `.figma/screenshot/<task-id>/`, opened, summarized, then terminally deleted;
- terminal outcome/archive failure handling;
- singular environment order: version → top help → status help → status → connect help/connect if needed → status.

- [ ] **Step 6: Rewrite `SKILL.md` once and set `version: 2.0`**

Keep frontmatter description trigger-only. The compact body contains:

1. Overview and authority invariant.
2. Non-Negotiable Rules.
3. Mandatory Lookups.
4. State-machine summary for 0A/0B/1–11 and 4A–4I.
5. Design and write approvals.
6. Workflow input/output/Gate/next-state contracts.
7. Completion and archival Gate.
8. Red flags and rationalizations justified by actual baselines.

Do not duplicate naming tables, helper usage, schema fields, or detailed Geometry mechanics from references.

- [ ] **Step 7: Run deterministic contract tests and refactor until GREEN**

```bash
node --test figma-skill/tests/workflow-contract.test.mjs figma-skill/tests/naming-and-workflow.test.mjs
```

Expected: PASS and size budgets satisfied.

- [ ] **Step 8: Run fresh-context GREEN once for every S1–S13, S15.1–S15.3, and S16–S25**

Each agent reads `SKILL.md` and only references routed by the relevant phase; it must not read `tests/`. Record choice, next action, verbatim rationale, reference files loaded, and verdict. Any failure blocks commit.

- [ ] **Step 9: Run five-sample micro-tests for six critical v2 rules**

For each of these, run five independent fresh contexts plus a no-guidance control captured in Task 1 or a new control if Task 1 lacked the failure:

1. resume requires confirmation and live revalidation;
2. read-only audit cannot correct;
3. active lease cannot be overwritten;
4. successful Figma write + failed checkpoint cannot be repeated;
5. terminal cleanup deletes only the owning task's screenshots;
6. persisted state never outranks live Figma.

Manually read every result. Guidance passes only when all five skill-enabled samples choose the required action and variance converges. If a rule fails, revise the relevant authoritative reference within this same uncommitted Task 10 change, rerun all five samples, and record the final wording/result. Do not bump beyond 2.0 because runtime v2 has not yet been committed.

- [ ] **Step 10: Write `v2-green-results.md`**

Record actual runs only. Separate deterministic results, full pressure runs, micro-test variants, controls, new rationalizations, and wording changes. Never label marker presence as behavioral coverage.

- [ ] **Step 11: Run the disposable real-Figma cross-session rehearsal before commit**

Precondition: Figma is open to a disposable test file and `figma-cli status` passes. Session A creates one uniquely named temporary frame/component, checkpoints after one batch, and releases without completing. A distinct fresh Session B discovers the task, asks for confirmation, acquires the lease, live-revalidates the node, completes remaining Todos, runs six validation Gates, records visual findings, archives, verifies its screenshot directory is gone, and leaves unrelated task screenshots untouched.

If no disposable connected Figma file is available, Task 10 remains in progress and v2 runtime docs are not committed or published.

- [ ] **Step 12: Write the E2E evidence**

Create `figma-skill/tests/v2-e2e-results.md` with task ID, two distinct session IDs, checkpoint revisions, live NodeId revalidation result, Gate evidence paths, screenshot deletion count/residue, archive status, and final Git diff summary. Do not include tokens or absolute home paths.

- [ ] **Step 13: Run all current tests before the only runtime-doc commit**

```bash
node figma-skill/tests/validate-skill.mjs
node --test figma-skill/tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
git diff --check
```

Expected: all PASS.

- [ ] **Step 14: Commit and push the activated v2 runtime**

```bash
git add -A
git commit -m "feat(figma-skill): activate v2 persistent workflows"
git push origin main
```

The push sync hook must complete best-effort. Do not claim v2 activation until Task 11 verifies the runtime snapshot.

---

### Task 11: Finalize deterministic validators, traceability, and release verification

**Files:**
- Modify: `figma-skill/tests/validate-skill.mjs`
- Modify: `figma-skill/tests/naming-results.md`
- Modify: `figma-skill/tests/green-results.md`
- Modify: `figma-skill/scripts/README.md`
- Test: all `figma-skill/tests/*`

**Interfaces:**
- Consumes the committed v2 runtime and behavioral evidence.
- Produces release-level deterministic coverage, non-stale traceability, and verified runtime synchronization.

- [ ] **Step 1: Replace legacy presence assertions with v2 invariants**

Update `validate-skill.mjs` required files for schemas, state helper/modules, new references, new helpers, and test evidence. Remove the old prohibition on cross-task persistence and `.figma/cache.json`-specific assumptions while retaining an explicit ban on treating `.figma/` observations as live truth.

Assert:

- frontmatter version exactly `2.0`;
- no old `references/discovery-and-planning.md` route;
- all required references appear in Mandatory Lookups;
- terminal screenshot cleanup contract;
- `CANCELLED` and archive states;
- all six Geometry gates;
- no live default NodeIds;
- no obsolete `scripts/figma-helpers/` paths;
- no `temp/figma-screenshot/` path;
- scenario/oracle/baseline/green ID synchronization.

- [ ] **Step 2: Fix existing false-pass tests**

Replace `includesAny` for three-page architecture with independent assertions for all three Pages. Correct Workflow block slicing to stop at the next heading, not a later end marker. Make ordered Gate tests parse section-local content.

- [ ] **Step 3: Rewrite traceability without hard-coded line numbers**

`naming-results.md` maps v2 spec sections to stable headings, exported interface names, schema names, and test names. Do not cite mutable SKILL line numbers. Mark pressure scenarios as covered only when `v2-green-results.md` contains actual fresh-context results.

- [ ] **Step 4: Update the canonical results summary**

`green-results.md` must distinguish historical v1 results from v2 behavioral runs and link to `v2-baseline-results.md`, `v2-green-results.md`, and `v2-e2e-results.md`.

- [ ] **Step 5: Run complete verification**

```bash
node figma-skill/tests/validate-skill.mjs
node --test figma-skill/tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
for f in figma-skill/scripts/*.mjs figma-skill/scripts/lib/task-state/*.mjs; do node --check "$f" || exit 1; done
git diff --check
```

Expected: all PASS.

- [ ] **Step 6: Verify the synced runtime snapshot**

Compare repository and runtime fingerprints for `SKILL.md`, every runtime reference, schema, and script:

```bash
node sync-skills.mjs --only-changed -v
node - <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const roots = ['figma-skill', `${process.env.USERPROFILE}/.claude/skills/figma-skill`];
function walk(root, rel = '') {
  return fs.readdirSync(path.join(root, rel), {withFileTypes:true}).flatMap(e => {
    const next = path.join(rel, e.name);
    return e.isDirectory() ? walk(root, next) : [next.replaceAll('\\','/')];
  });
}
const runtime = walk(roots[0]).filter(f => /^(SKILL\.md|references\/|scripts\/|schemas\/)/.test(f)).sort();
for (const rel of runtime) {
  const hashes = roots.map(root => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex'));
  if (hashes[0] !== hashes[1]) throw new Error(`runtime mismatch: ${rel}`);
}
console.log(`PASS: ${runtime.length} runtime files synchronized`);
NODE
```

Expected: synchronization PASS. Adjust the runtime root only if the environment reports a different configured skills directory; do not copy from runtime back into the repository.

- [ ] **Step 7: Commit and push final test/traceability changes**

```bash
git add -A
git commit -m "test(figma-skill): certify v2 persistent workflows"
git push origin main
```

- [ ] **Step 8: Confirm clean, pushed final state**

```bash
git status --short
git log -2 --oneline --decorate
```

Expected: no status output; `HEAD`, `origin/main`, and `origin/HEAD` point to the final certification commit.

## Plan Self-Review

### Spec coverage

- Persistent project ledger, task formats, multi-task index: Tasks 2–3.
- Leases, revision, transition model, checkpoint order: Tasks 4–5.
- Todo, evidence, SHA-256, redaction, path containment: Task 5.
- Terminal summary, compressed archive, task-isolated screenshot deletion, no count limit, archive failure: Task 6.
- Read helper and Page/scoped AABB correctness: Task 7.
- Write helper fail-closed behavior: Task 8.
- Bounds and installer review findings: Task 9.
- Workflow 0A/0B, 4I, Audit branch, Workflow 7, help order, six Geometry Gates, reference routing, SKILL reduction: Task 10.
- True RED/GREEN pressure testing and five-sample micro-tests: Tasks 1 and 10.
- Real two-session Figma recovery rehearsal: Task 10.
- Deterministic invariants, version 2.0, traceability, commit/push/sync: Task 11.

### Placeholder scan

The plan contains no unresolved design markers, deferred implementation language, unspecified error handling, or unnamed test action. Angle-bracket values appear only in documented runtime formats such as `<task-id>` and `<Current workspace>`.

### Interface consistency

- Error codes are defined in Task 2 and consumed unchanged thereafter.
- Task statuses include `CANCELLED`; archive status is independent.
- All CLI mutations use task ID, session holder, and expected revision where applicable.
- Screenshots always use `.figma/screenshot/<task-id>/`; no task uses a count limit.
- Evidence IDs use `EV-####`, Todo IDs use `T-###`, and event IDs use `E-####`.
- Geometry helper envelopes consistently use `ok`, `code`, `summary`, `issues`, and compatibility fields.
- Runtime documentation is modified and versioned exactly once, in Task 10, after GREEN and E2E gates pass.
