---
name: figma-skill-v2-persistent-task-state
model: sonnet
category: design
description: Major-version design for project-tracked Figma task memory, resumable workflows, lease-controlled checkpoints, verifier hardening, and behavior-tested execution.
version: 2.0
---

# `figma-skill` v2.0 — Persistent Task State and Workflow Hardening

**Date:** 2026-07-14  
**Status:** Awaiting written-spec user review  
**Target version:** `figma-skill` 2.0  
**Depends on:** `figma-skill` 1.2.4

## 1. Decision Summary

Version 2.0 introduces project-level, cross-session task memory under
`<Current workspace>/.figma/`. Every concrete Figma Create, Modify, Audit,
Migrate, or Export task gets an independent tracked task directory containing
its approved plan, Todo list, current workflow state, append-only event log,
recovery summary, lease, and evidence.

The chosen architecture is a hybrid checkpoint ledger:

- JSON for machine state, schemas, indexes, leases, and evidence manifests;
- Markdown for human-reviewed plans, Todos, and recovery summaries;
- JSONL for append-only audit events;
- one offline state helper as the only writer for structured state files;
- task-level write leases to prevent concurrent sessions from mutating the same
  task or Figma scope;
- all `.figma/` files are eligible for Git tracking;
- checkpoints update files but do not create automatic checkpoint commits;
- task delivery or an explicit user request commits `.figma/` together with the
  related project changes.

This is a major release because it reverses the current prohibition on
cross-task persistence, adds a new task lifecycle and recovery entry point,
changes the default behavior of all concrete Figma tasks, and restructures
Workflows 0–11.

## 2. Goals

1. Preserve plans, execution progress, Todos, approvals, evidence, failures,
   and recovery instructions across sessions.
2. Allow multiple Figma tasks to coexist under one project without sharing or
   overwriting state.
3. Recover safely after interruption without treating stored NodeIds or
   geometry as live Figma truth.
4. Prevent two sessions from concurrently writing the same task.
5. Make workflow transitions, checkpoints, Todo completion, and evidence
   requirements machine-validatable.
6. Fix the v1.2.4 state-machine, reference-routing, Geometry Verifier, helper
   script, and test defects found during the 2026-07-14 full review.
7. Reduce `SKILL.md` to a concise state-machine and routing contract, with each
   detailed rule defined in one authoritative reference.
8. Establish genuine RED-GREEN-REFACTOR evidence for the discipline-enforcing
   parts of the skill.

## 3. Non-Goals

1. `.figma/` is not a cache of current Figma truth.
2. Stored NodeIds, parent relations, geometry, variables, styles, connection
   status, or CLI help output may not bypass a live re-read.
3. The lease is not a distributed lock with network consensus. It is a
   Git-visible task ownership protocol enforced by the skill and state helper.
4. Version 2.0 does not implement a general project-management system outside
   Figma tasks.
5. The state helper does not connect to the Figma daemon and does not execute
   Figma writes.
6. Checkpoints do not automatically create Git commits.
7. No authentication token, daemon token, authorization header, complete
   environment dump, or secret may be stored under `.figma/`.
8. Unknown data schemas are not silently migrated.
9. The deprecated `.figma/cache.json` design is not revived or migrated.
10. Pure conceptual questions about Figma or `figma-cli` do not create a task.

## 4. Core Invariants

### 4.1 The ledger is not live truth

`.figma/` records what was planned, approved, observed, attempted, validated,
and left unfinished. Before any resumed write, the agent must reconnect and
re-read the live Figma file, Page, target nodes, parents, and geometry.

Persisted observations must be labelled as observations from a specific
checkpoint. They may never be presented as current facts until revalidated.

### 4.2 Recovery is not immediate continuation

A recovered task follows this fixed gate:

```text
Read ledger
→ acquire task lease
→ run Workflow 1 environment checks
→ identify current Figma file and Page
→ re-read critical NodeIds, parents, and geometry
→ compare live state with persisted observations
→ set ResumeGate
```

`ResumeGate=PASS` is required before a Figma write.

### 4.3 Read-only audits never mutate

For `WriteRequired=False`:

```text
Workflow 9 FAIL or FINDINGS
→ record findings and evidence
→ do not enter Workflow 10
→ deliver an audit result in Workflow 11
```

A later repair request creates a Modify task or moves the task to
`NEEDS_REPLAN` and repeats Workflow 6 approval before writing.

### 4.4 Authority order

When information conflicts, authority is fixed:

```text
Current live Figma state
> current figma-cli --help
> user's latest explicit approval
> .figma task state.json
> plan.md and todo.md
> events.jsonl history
```

### 4.5 One structured-state writer

The offline `scripts/figma-task-state.mjs` helper is the only supported writer
for `index.json`, `state.json`, `lease.json`, `events.jsonl`, and evidence
manifest mutations. Agents and humans may read every file. Manual edits must
pass `figma-task-state validate` before another checkpoint.

## 5. Persistence Scope and Git Policy

### 5.1 Tasks that create a ledger

Create a persisted task when the request targets a concrete Figma file or
requires concrete Figma discovery for any of these task types:

- Create
- Modify
- Audit
- Migrate
- Export

Do not create a task for conceptual advice, command explanation, or design
brainstorming that does not inspect a concrete Figma file. If such a
conversation later begins concrete Figma discovery, create the task at that
transition.

### 5.2 Version control

All `.figma/` task files are project assets and may be committed. Stable,
project-relative paths are mandatory. Evidence must be redacted before it is
registered.

Checkpoint behavior:

- update `.figma/` files at mandatory checkpoints;
- do not automatically run `git add`, `git commit`, or `git push` per
  checkpoint;
- commit task state with related project changes at delivery, or when the user
  explicitly requests a commit;
- obey stricter project-level Git instructions when present.

## 6. Directory Layout

```text
<Current workspace>/
└── .figma/
    ├── README.md
    ├── config.json
    ├── index.json
    ├── schemas/
    │   ├── config.schema.json
    │   ├── index.schema.json
    │   ├── task-state.schema.json
    │   └── event.schema.json
    ├── tasks/
    │   └── <task-id>/
    │       ├── state.json
    │       ├── lease.json
    │       ├── plan.md
    │       ├── todo.md
    │       ├── recovery.md
    │       ├── events.jsonl
    │       └── evidence/
    │           ├── manifest.json
    │           ├── help/
    │           ├── baseline/
    │           ├── batches/
    │           └── validation/
    └── screenshot/
        └── <task-id>/
            └── <temporary visual-validation files>
```

Task IDs use the deterministic form `YYYYMMDD-<slug>`. If a collision exists,
append `-02`, `-03`, and so on. IDs never change after task creation.

Each task gets an isolated temporary screenshot directory. Screenshots exist
only while the task is resumable and are removed during terminal-state
archival. There is no screenshot count limit: task isolation prevents one
active task from accumulating files in or deleting files from another task.

## 7. File Contracts

### 7.1 `.figma/config.json`

Project-level stable configuration:

```json
{
  "schemaVersion": 1,
  "defaultBranch": "main",
  "taskIdFormat": "YYYYMMDD-slug",
  "leaseMinutes": 30,
  "evidencePolicy": "tracked",
  "redactionPolicy": "strict"
}
```

Prohibited values include tokens, secrets, user-home absolute paths, and full
environment snapshots.

### 7.2 `.figma/index.json`

The index stores task summaries only:

```json
{
  "schemaVersion": 1,
  "tasks": [
    {
      "id": "20260714-checkout-responsive",
      "title": "Checkout responsive states",
      "type": "Modify",
      "status": "ACTIVE",
      "currentWorkflow": "8",
      "updatedAt": "2026-07-14T10:42:00+08:00"
    }
  ]
}
```

Multiple tasks may be `ACTIVE`, but each task may have no more than one valid
WRITE lease.

### 7.3 `state.json`

`state.json` is the machine-readable current truth for the task ledger:

```json
{
  "schemaVersion": 1,
  "revision": 12,
  "taskId": "20260714-checkout-responsive",
  "taskType": "Modify",
  "writeRequired": true,
  "status": "ACTIVE",
  "currentWorkflow": "8",
  "gate": "BatchGate",
  "gateStatus": "PASS",
  "approval": {
    "designSystem": "APPROVED",
    "figmaWrite": "APPROVED"
  },
  "batch": {
    "current": 2,
    "lastCompleted": 1
  },
  "correctionRounds": 0,
  "resume": {
    "required": true,
    "lastCheckpoint": "batch-1-complete",
    "liveRevalidation": "REQUIRED"
  },
  "observedContext": {
    "figmaFile": "Checkout product file",
    "page": "02 Screens",
    "nodeIds": ["123:45"]
  },
  "evidenceRefs": ["EV-003"],
  "updatedAt": "2026-07-14T10:42:00+08:00"
}
```

Rules:

- every mutation increments `revision` by exactly one;
- writes use a temporary file followed by same-directory rename;
- an illegal workflow transition is rejected;
- `observedContext` is always stale-until-revalidated after session recovery;
- index summary fields must match the referenced task state after checkpoint.

### 7.4 `plan.md`

The approved plan contains:

- task boundary;
- Create, Modify, Rename, Reuse, Instantiate, Duplicate, and migration scopes;
- affected dependencies and out-of-scope issues;
- CommandPlan;
- placement and geometry audits;
- unified six-field EvalRunFallback when applicable;
- baseline and validation plans;
- approval state and approval event IDs.

A material change does not silently overwrite an approved plan. The old plan
is marked `SUPERSEDED`, a new version is created, and the task becomes
`NEEDS_REPLAN` until the new plan receives approval.

### 7.5 `todo.md`

Every Todo has a stable ID and machine-readable metadata:

```markdown
- [ ] T-001 Re-read target Section children
  - workflow: 7
  - blockedBy: []
  - evidence: []
- [ ] T-002 Apply approved layout batch
  - workflow: 8
  - blockedBy: [T-001]
  - evidence: []
```

Rules:

- Todo IDs are immutable and never reused;
- a completed Todo must reference evidence or an event ID;
- changing a checkbox alone does not update task state;
- dependencies must reference existing Todo IDs;
- cycles are rejected;
- manual edits must pass parser and schema validation.

### 7.6 `events.jsonl`

The event log is append-only. Each line is a complete JSON object:

```json
{"eventId":"E-0012","taskId":"20260714-checkout-responsive","revision":12,"type":"BATCH_COMPLETED","workflow":"8","actor":"session-id","at":"2026-07-14T10:42:00+08:00","evidence":["EV-003"]}
```

Required event types:

- `TASK_CREATED`
- `LEASE_ACQUIRED`
- `LEASE_TAKEN_OVER`
- `APPROVAL_RECORDED`
- `WORKFLOW_ENTERED`
- `TODO_UPDATED`
- `BATCH_STARTED`
- `BATCH_COMPLETED`
- `VALIDATION_RECORDED`
- `STALE_DETECTED`
- `REPLAN_REQUIRED`
- `TASK_BLOCKED`
- `TASK_FAILED`
- `TASK_CANCELLED`
- `TASK_COMPLETED`
- `SCREENSHOTS_CLEANED`
- `TASK_ARCHIVED`
- `ARCHIVE_FAILED`
- `LEASE_RELEASED`

Events support audit and recovery diagnosis. Current state is not reconstructed
from events during normal operation.

### 7.7 `recovery.md`

The recovery summary contains:

- user goal;
- current Workflow and Gate;
- last completed action;
- exactly one next action;
- incomplete and blocked Todos;
- known failures and risks;
- file, Page, and node observations that require live revalidation;
- facts that must not be reused without re-reading;
- current lease state.

### 7.8 `evidence/manifest.json`

Every evidence file is registered:

```json
{
  "EV-003": {
    "kind": "validation",
    "path": "validation/overlap-check-batch-1.json",
    "command": "figma-cli run scripts/overlap-check.mjs",
    "workflow": "9",
    "sha256": "<computed digest>",
    "redacted": true
  }
}
```

Requirements:

- paths are relative to the task's evidence directory;
- evidence cannot escape the project root;
- SHA-256 is computed after redaction;
- command evidence omits tokens, authorization headers, daemon secrets, and
  unnecessary absolute paths;
- evidence required by a Gate must exist, match its manifest digest, and parse
  successfully before the Gate may PASS.

## 8. Task Status and Transition Model

### 8.1 Status values

```text
DRAFT
WAITING_DESIGN_APPROVAL
WAITING_WRITE_APPROVAL
READY
ACTIVE
BLOCKED
STALE
NEEDS_REPLAN
FAILED
COMPLETED
SUPERSEDED
```

Definitions:

- `DRAFT`: discovered or created but not ready for approval or execution.
- `WAITING_DESIGN_APPROVAL`: design-system changes await explicit approval.
- `WAITING_WRITE_APPROVAL`: Figma write plan awaits explicit approval.
- `READY`: all required approvals exist and live baseline is still required.
- `ACTIVE`: a Workflow or execution batch is in progress.
- `BLOCKED`: connection, permission, file, evidence, capability, or user input
  prevents progress.
- `STALE`: stored observations differ from live state and cannot be safely
  reconciled automatically.
- `NEEDS_REPLAN`: target, scope, dependency, structure, degradation path, or
  approval premise materially changed.
- `FAILED`: a hard Gate or correction limit produced a terminal failure.
- `CANCELLED`: the user explicitly ended the task before completion.
- `COMPLETED`: Workflow 11 evidence and delivery completed.
- `SUPERSEDED`: another task or plan replaced this task.

Terminal task outcome and archival state are independent. `status` preserves
why the task ended, while `archiveStatus` is one of `NOT_ARCHIVED`,
`ARCHIVING`, `ARCHIVED`, or `ARCHIVE_FAILED`. A terminal task is not fully
reclaimed until `archiveStatus=ARCHIVED`.

### 8.2 Live observation classifications

On recovery, each critical target is classified:

- `verified`: NodeId exists and type, semantic identity, and parent match;
- `relocated`: semantic identity is unique but NodeId or parent changed;
- `missing`: target is absent;
- `ambiguous`: multiple candidates exist;
- `changed`: relevant geometry, layout, constraint, or structure differs.

Transition rules:

- all `verified` → `ResumeGate=PASS`;
- only uniquely `relocated` observations → update baseline, append event, then
  allow `ResumeGate=PASS`;
- any `missing` or `ambiguous` → `STALE`;
- any change affecting approved scope or plan → `NEEDS_REPLAN`;
- inability to identify the current file or collect evidence → `BLOCKED`.

## 9. Task Lease Protocol

`lease.json` has this contract:

```json
{
  "taskId": "20260714-checkout-responsive",
  "holder": "session-id",
  "mode": "WRITE",
  "acquiredAt": "2026-07-14T10:12:00+08:00",
  "heartbeatAt": "2026-07-14T10:42:00+08:00",
  "expiresAt": "2026-07-14T11:12:00+08:00",
  "stateRevision": 12
}
```

Rules:

1. A valid WRITE lease is required before mutating task state or Figma.
2. Sessions without the lease may inspect task files in read-only mode.
3. Lease duration defaults to 30 minutes.
4. Heartbeat updates occur at checkpoints; no background timer is required.
5. A long batch renews the lease before its write phase.
6. Taking over an unexpired lease requires explicit user approval and a
   `LEASE_TAKEN_OVER` event.
7. The previous holder is rejected on its next mutation because holder or
   revision no longer matches, then returns to read-only recovery.
8. No authentication or daemon token is stored in the lease.

## 10. Checkpoint Transaction

Every checkpoint follows this order:

```text
1. validate WRITE lease
2. read and compare state revision
3. validate requested state transition
4. write redacted evidence files
5. update evidence manifest
6. append events.jsonl
7. update plan.md, todo.md, and recovery.md as applicable
8. atomically replace state.json
9. atomically replace index.json
10. update lease heartbeat
11. validate the complete .figma directory
```

Failure handling:

- checkpoint completion may not be claimed;
- the last valid `state.json` revision remains authoritative;
- diagnostic temporary files remain available for explicit recovery;
- the next session resumes from the last valid revision;
- if a Figma write succeeded but its checkpoint failed, the task becomes
  `BLOCKED`, live Figma state is re-read, recovery evidence is generated, and
  the write must not be repeated blindly.

Mandatory checkpoints:

- task creation;
- every Workflow ENTER, PASS, and FAIL;
- each approval or rejection;
- every write batch START, COMPLETE, or PARTIAL;
- completion of each correction round;
- every verifier Gate result;
- `STALE`, `NEEDS_REPLAN`, or `BLOCKED` transition;
- Workflow 11 `FAILED` or `COMPLETED` delivery;
- deliberate session handoff or release.

## 11. Offline State Helper

Add `scripts/figma-task-state.mjs`. It reads and writes only the current
project's `.figma/` tree and never connects to the Figma daemon.

Supported commands:

```text
init-project
list
create
show
acquire
takeover
checkpoint
todo-add
todo-update
evidence-add
validate
release
archive
close
```

`archive` performs terminal-state summary generation, task-scoped screenshot
cleanup, runtime-material compaction, residue verification, and archive-state
transition. `close` refuses to finalize a terminal task unless archival passes.

Command requirements:

- every mutating command supports `--dry-run`;
- every command supports structured `--json` output;
- errors expose stable codes;
- writes use temporary files and same-directory rename;
- revision and lease are checked before mutation;
- no Git command is executed automatically;
- project-root escape and evidence-path traversal are rejected;
- sensitive key/value patterns are rejected before write;
- the helper is registered as a pre-approved offline project-state tool and
  does not require EvalRunFallback.

Stable error codes:

```text
PROJECT_NOT_INITIALIZED
SCHEMA_UNSUPPORTED
STATE_INVALID
REVISION_CONFLICT
LEASE_HELD
LEASE_EXPIRED
LEASE_LOST
TASK_NOT_FOUND
ILLEGAL_TRANSITION
PLAN_NOT_APPROVED
LIVE_REVALIDATION_REQUIRED
EVIDENCE_MISSING
SENSITIVE_DATA_REJECTED
PATH_OUTSIDE_PROJECT
```

## 12. Revised Workflow Architecture

### 12.1 Main path

```text
0A Persistent Task Discovery
→ 0B Task Classification
→ 1 Environment and Resume Gate
→ 2 Design System Gate
→ 3 Page Architecture Audit
→ 4 Target Discovery
→ 4A–4I Task Entry
→ 5 Name Decision when applicable
→ 6 Write Plan Approval when WriteRequired=True
→ 7 Live Baseline Capture
→ 8 Fixed-Order Execution when WriteRequired=True
→ 9 Validation or Audit Evidence
→ 10 Correction only when WriteRequired=True
→ 11 Checkpointed Delivery
```

### 12.2 Workflow 0A — Persistent Task Discovery

1. Detect and validate `.figma/index.json`.
2. List `ACTIVE`, `BLOCKED`, `STALE`, and `NEEDS_REPLAN` tasks.
3. If exactly one task matches the request, show its recovery summary and ask
   whether to resume it.
4. If multiple tasks match, present task ID, title, type, status, current
   Workflow, and last update; the user chooses one.
5. If the user chooses a new task, create its directory and initial checkpoint.
6. A task is never silently resumed merely because it is the only active task.

### 12.3 Workflow 0B — Task Classification

Retain Create, Modify, Audit, Migrate, and Export. Set `WriteRequired` from the
actual requested behavior. Export receives a dedicated task entry.

### 12.4 Workflow 1 — Environment and Resume Gate

Use this fixed sequence:

```text
figma-cli --version
figma-cli --help
figma-cli status --help
figma-cli status
if disconnected:
  figma-cli connect --help
  figma-cli connect
  figma-cli status
```

A resumed task then performs live file, Page, NodeId, parent, and geometry
revalidation. A CLI version or help difference invalidates stored HelpEvidence
for the changed command family.

### 12.5 Workflow 4I — Export

The Export entry defines:

- requested nodes and output format;
- output directory and naming;
- source-state validation;
- whether export is read-only;
- screenshot or artifact evidence;
- delivery manifest.

Export does not enter write approval unless the requested operation also
modifies Figma.

### 12.6 Workflow 7 — Live Baseline Capture

Data sources are explicit:

| Data | Source |
|---|---|
| Direct children and sibling boxes | `list-children.mjs` |
| Positioning, sizing, and constraints | `figma-cli inspect --json <id>` |
| Parent layout mode and full geometry | extended inspect helper or dedicated read-only helper |
| Text auto-resize when unavailable | `UNAVAILABLE`, followed by Visual evidence |
| Persisted baseline | diff aid only; live re-read remains mandatory |

Workflow 7 cannot PASS if required data is absent or falsely inferred.

### 12.7 Workflow 9 and 10 branching

For `WriteRequired=True`:

```text
Workflow 9 FAIL → Workflow 10 → Workflow 9
```

For `WriteRequired=False`:

```text
Workflow 9 FINDINGS → record evidence → Workflow 11
```

A read-only task never reaches Workflow 6, 8, or 10.

### 12.8 Workflow 11 — Checkpointed Delivery and Reclamation

Workflow 11 first produces the delivery result and terminal outcome, then runs
a mandatory reclamation transaction for every terminal status:
`COMPLETED`, `FAILED`, `CANCELLED`, or `SUPERSEDED`.

The transaction order is fixed:

```text
1. freeze further task and Figma writes
2. generate final-summary.md
3. write final plan, Todo, state, and evidence-index snapshots
4. convert screenshot observations into durable textual validation findings
5. recursively delete .figma/screenshot/<task-id>/
6. verify that the task screenshot directory is absent or contains zero files
7. remove lease.json, temporary files, intermediate batch output, reproducible
   baselines, and non-key command output
8. reduce evidence/manifest.json to retained key-evidence references
9. append SCREENSHOTS_CLEANED and TASK_ARCHIVED events
10. set archiveStatus=ARCHIVED while preserving the terminal status
11. validate the complete .figma directory
```

`final-summary.md` retains the task goal, final outcome, implemented or audited
changes, final validation conclusions, screenshot count and visual findings,
correction history, unresolved issues, deleted-material summary, and links to
related or superseding tasks. Raw screenshots are temporary and are never a
required long-term artifact after their observations have been summarized.

If screenshot deletion or any later reclamation step fails, set
`archiveStatus=ARCHIVE_FAILED`, append `ARCHIVE_FAILED`, and do not claim that
the task was fully reclaimed. `BLOCKED`, `STALE`, and `NEEDS_REPLAN` remain
resumable and therefore retain their isolated screenshot directories.

The delivery report references task ID, final revision, plan version, Todo
summary, retained evidence manifest, correction rounds, unresolved issues,
terminal status, archive status, screenshot deletion count, and lease release.
A completed task is fully closed only after its terminal checkpoint, screenshot
residue check, archive validation, and lease release all pass.

Because checkpoint Git commits are not automatic, the normal final commit does
not contain task screenshots: Workflow 11 removes them before delivery commit.
If a human previously committed screenshots during an active task, later
reclamation removes them from the current tree but does not rewrite Git
history.

## 13. Unified Eval/Run Contract

Every definition uses this six-field structure:

```text
NativeHelpChecked
MissingNativeCapability
TargetNodeIds
FallbackCodeScope
FallbackImpact
GeometryReaudit
```

No reference may call it a five-fact gate. Pre-approved helper scripts retain
separate read/write authorization, but write helpers still require Workflow 6
CommandPlan approval.

## 14. Geometry Verifier v2

### 14.1 Gate sequence

```text
1. Lint Gate
2. Duplicate-Origin Gate
3. Top-Level AABB Gate
4. Scoped Children AABB Gate
5. Variant Parity Gate
6. Visual Gate
```

Every Gate emits structured evidence and a parsed PASS/FAIL decision.
Successful command execution alone is not a PASS.

### 14.2 Lint Gate

`figma-cli lint --json` output is parsed by supported shape:

- Yolo-style result: `messages.length === 0` is PASS;
- Safe-style result: `issues.length === 0` and `total === 0` is PASS;
- unrecognized or malformed output is FAIL;
- v2.0 strict mode treats error, warning, and info messages as blocking unless
  the approved plan explicitly defines a narrower lint policy.

The old rule “non-empty output is FAIL” is removed because a clean JSON result
is itself a non-empty object.

### 14.3 Duplicate-Origin Gate

`figma-cli unstack --dry-run` is documented accurately as duplicate or
near-duplicate top-level origin detection. It is not described as a full AABB
intersector and does not claim JSON output.

### 14.4 Top-Level AABB Gate

A new read-only Page-level verifier checks all current Page top-level children
for area intersection even when their origins differ. It emits structured
pairs and explicitly reports its rotation/effect-bound limitations.

### 14.5 Scoped Children AABB Gate

Every in-scope Section or Frame is checked, not only one hard-coded parent.
The helper output identifies the parent and uses explicit `ok`, `code`,
`summary`, and `issues` fields.

### 14.6 Variant Parity Gate

Variant parity becomes an unambiguous hard Gate. It may no longer be labelled
“辅助，非闸门”. Required sizing fields and the accepted baseline strategy are
stored in evidence.

### 14.7 Visual Gate

The agent opens the actual screenshots. Visual evidence remains authoritative
for text clipping, effect extents, and visual defects that machine geometry
cannot determine.

## 15. Helper Script Hardening

All Figma helper scripts must:

1. default required NodeId constants to empty values and fail before operating;
2. use asynchronous node lookup where supported;
3. validate that a target parent supports children;
4. return a common envelope:

```json
{
  "ok": false,
  "code": "OVERLAP_FOUND",
  "summary": {},
  "issues": [],
  "observedAt": "2026-07-14T10:42:00+08:00"
}
```

5. require Workflow logic to parse `ok` rather than infer success from command
   completion;
6. validate expected parent and baseline revision for write plans;
7. treat any partial `apply-layout` result as batch failure;
8. account for minX, minY, maxX, and maxY during resize, or reject negative
   coordinates explicitly;
9. document whether rotation and effect bounds are supported;
10. remove obsolete `scripts/figma-helpers/` paths;
11. avoid live example NodeIds in runnable defaults.

The installer additionally:

- restricts `InstallRoot` to a validated leaf directory before recursive
  deletion;
- adds an explicit artifact integrity policy;
- expands tests beyond `-PlanOnly` to safe temporary install fixtures.

## 16. Reference Architecture

`SKILL.md` becomes the concise contract for:

- non-negotiable invariants;
- workflow/state summary;
- approval and completion gates;
- Mandatory Lookups;
- reference routing.

Detailed authorities:

```text
references/installation.md
references/naming.md
references/state-and-recovery.md
references/planning.md
references/execution.md
references/geometry-verifier.md
references/validation.md
```

Rules:

- a detailed rule has exactly one authoritative location;
- summaries in `SKILL.md` link to, but do not restate, detailed mechanics;
- `geometry-verifier.md` is mandatory for Workflows 7, 9, and 10;
- diagrams must be generated from, or mechanically checked against, the state
  transition table;
- the main skill receives an enforced size budget during implementation;
- obsolete or duplicated reference text is removed rather than retained as a
  second authority.

## 17. Testing Strategy

### 17.1 State-helper unit tests

Cover:

- project initialization;
- schema validation and unsupported-schema rejection;
- task create, list, and show;
- revision conflicts;
- lease acquisition, expiry, takeover, loss, and release;
- legal and illegal transitions;
- stable Todo IDs, dependencies, and cycle rejection;
- evidence registration and SHA-256 verification;
- sensitive-data rejection;
- project-root and evidence-path escape rejection;
- atomic-write failure recovery;
- JSONL append integrity.

### 17.2 Mock Figma runtime tests

Behaviorally test:

- `list-children.mjs`;
- `overlap-check.mjs`;
- `apply-layout.mjs`;
- `resize-section.mjs`;
- the new top-level AABB verifier.

Cases include empty and stale IDs, wrong parent types, negative coordinates,
rotation limitations, partial apply, wrong parent, area overlap, touching
edges, zero-size nodes, and resize on every boundary.

### 17.3 Structural consistency tests

Assert invariants rather than generic keywords:

- every TaskType has a task entry;
- a read-only path cannot reach Workflows 6, 8, or 10;
- diagram edges match the transition table;
- every runtime reference is present in Mandatory Lookups;
- all EvalRunFallback contracts have the same six fields;
- Geometry Verifier Gate order is identical everywhere;
- duplicate authorities are rejected;
- the `SKILL.md` size budget is enforced;
- scenario and expected-behavior IDs are synchronized;
- traceability does not use stale hard-coded line numbers.

### 17.4 Skill RED-GREEN behavior tests

For each new discipline rule:

1. run a fresh-context baseline without the skill;
2. record exact selection, next action, and verbatim rationalization;
3. add only guidance justified by observed failure;
4. run fresh-context tests with the skill;
5. micro-test wording with a no-guidance control and at least five samples per
   variant;
6. preserve test evidence in the repository.

Required scenarios include unique-task recovery, multi-task selection, stale
NodeIds, active lease conflict, lease takeover, checkpoint failure after a
successful Figma write, read-only audit findings, persisted-plan/live-state
conflict, sensitive-data rejection, and CLI-version HelpEvidence invalidation.

Existing S9–S13 and S15.1–S15.3 also receive missing RED and GREEN behavioral
runs.

### 17.5 End-to-end recovery test

A release-blocking E2E exercise must observe:

```text
Session A creates task
→ receives required approval
→ executes one batch
→ checkpoints
→ session ends
→ Session B discovers the task
→ user confirms recovery
→ Session B revalidates live Figma state
→ completes remaining Todos
→ runs all validation Gates
→ delivers and releases lease
```

The test verifies actual `.figma/` contents, task revision, Git diff, evidence,
and recovery behavior. Deterministic test success alone is insufficient.

## 18. Security and Redaction

Before `.figma/` content is written or committed:

- reject keys matching token, secret, password, authorization, cookie, or
  daemon credential patterns;
- redact home-directory prefixes from command output;
- store project-relative paths when possible;
- avoid complete process or environment dumps;
- refuse evidence paths outside the task directory;
- compute the evidence digest after redaction;
- append `ARCHIVE_FAILED`, preserve diagnostic state, and block final close when
  task-scoped screenshot or runtime-material cleanup fails;
- report a redaction failure as `SENSITIVE_DATA_REJECTED` and block the
  checkpoint.

Screenshots use `.figma/screenshot/<task-id>/`, are isolated by task, and have
no count limit. They remain available while a task is resumable, then are
summarized and deleted for every terminal task. The archive validator requires
zero remaining files for that task. Screenshots from other task IDs must never
be deleted by the current task's reclamation transaction.

Binary screenshots may exist in the tracked working tree during an active task,
but the normal delivery commit occurs only after terminal cleanup. The
implementation must test deletion isolation and residue detection rather than
defining a numeric screenshot-retention threshold.

## 19. Data Versioning and Migration

- `figma-skill` version becomes `2.0`.
- `.figma` data schemas begin at integer `schemaVersion: 1` independently.
- Projects without `.figma/` are initialized at first concrete Figma task.
- Unknown schemas open read-only and block mutation.
- Schema migration is an explicit helper command with `--dry-run`, backup, and
  post-migration validation.
- No deprecated cache file is imported as current state.

## 20. Delivery and Release Gates

Version 2.0 may ship only when all conditions pass:

1. read-only Audit cannot reach a write or correction Workflow;
2. all workflow diagrams match the transition table;
3. environment/help order is singular and deterministic;
4. EvalRunFallback is six-field everywhere;
5. `geometry-verifier.md` is routed by Mandatory Lookups;
6. Workflow 7 data sources can produce every required baseline field or mark it
   explicitly unavailable;
7. lint output is parsed by schema rather than textual non-emptiness;
8. `unstack --dry-run` is documented as duplicate-origin detection;
9. Page-level and scoped AABB Gates both exist;
10. variant parity is a hard Gate everywhere;
11. helper-script failure envelopes and behavioral tests pass;
12. state-helper unit and security tests pass;
13. RED/GREEN fresh-context evidence is recorded;
14. the cross-session E2E recovery exercise passes;
15. `SKILL.md` is reduced and has no duplicate authority;
16. every terminal status generates `final-summary.md`, removes only its own
    `.figma/screenshot/<task-id>/`, verifies zero residue, and reaches
    `archiveStatus=ARCHIVED`;
17. archive failure preserves the terminal outcome, records diagnostics, and
    blocks final close;
18. all deterministic regression tests pass;
19. the runtime skill snapshot is synchronized and re-verified.

## 21. Implementation Decomposition

The implementation plan should execute in this order:

1. state model, schemas, and offline helper;
2. `.figma/` project initialization and task file generation;
3. lease, revision, checkpoint, evidence, and redaction behavior;
4. Workflow 0A/0B and Resume Gate integration;
5. state-machine and diagram consistency fixes;
6. Workflow 7 data-source correction;
7. Geometry Verifier v2 and helper hardening;
8. reference restructuring and `SKILL.md` reduction;
9. deterministic and mock-runtime tests;
10. RED/GREEN pressure tests;
11. real cross-session E2E exercise;
12. version bump, traceability, commit, push, and runtime synchronization.

Each stage must leave tests passing before the next stage begins. The state
helper and schemas must be complete before `SKILL.md` mandates their use.

## 22. User-Approved Design Decisions

The user approved the following decisions during design review:

- all `.figma/` state is eligible for Git tracking;
- multiple independent task directories are supported;
- persistence occurs at Workflow and execution-batch checkpoints;
- the format is JSON + Markdown + JSONL;
- new sessions automatically discover tasks but require confirmation before
  resume;
- every concrete Figma task creates a task ledger;
- task-level leases control concurrent mutation;
- checkpoint files are committed at delivery rather than at every checkpoint;
- the hybrid checkpoint-ledger architecture is used;
- the release is version 2.0;
- the invariant, file-contract, lifecycle, workflow-hardening, state-helper,
  error-handling, and testing design sections were approved;
- terminal tasks use compressed archival rather than full retention or complete
  task-directory deletion;
- screenshots are isolated under `.figma/screenshot/<task-id>/`;
- screenshots have no numeric count limit and are deleted when the owning task
  enters any terminal state;
- `COMPLETED`, `FAILED`, `CANCELLED`, and `SUPERSEDED` all run summary,
  screenshot cleanup, residue verification, and compressed archival;
- `BLOCKED`, `STALE`, and `NEEDS_REPLAN` retain screenshots because they remain
  resumable.
