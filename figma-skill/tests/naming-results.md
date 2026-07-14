# v2.0 Naming, Workflow and Validator Traceability

This file maps the v2.0 specification (`docs/superpowers/specs/2026-07-14-figma-skill-v2-persistent-task-state-design.md`) to the committed runtime and the deterministic tests. It does **not** cite mutable SKILL.md line numbers; instead it references stable heading anchors, exported interface names, schema file names, and test functions.

## 1. Headings & Single Authority

| Spec Section | Runtime Authority | Marker |
| --- | --- | --- |
| §2 `state.json` canonical shape | `figma-skill/scripts/lib/task-state/model.mjs` (`TASK_STATUSES`, `TERMINAL_STATUSES`, `WRITE_REQUIRED_WORKFLOWS = Object.freeze(['6','8','10'])`, `ARCHIVE_STATUSES`, `EVENT_TYPES`, `TRANSITIONS`) | `tests/task-state-schema.test.mjs` keeps these arrays aligned with `schemas/task-state.schema.json` and `schemas/event.schema.json` |
| §5.4 Lease contract | `figma-skill/scripts/lib/task-state/lease.mjs` (`assertLeaseShape`, mode `WRITE`, exact key set) | `tests/task-state-lease.test.mjs` |
| §10 Checkpoint transaction | `figma-skill/scripts/lib/task-state/checkpoint.mjs` (lease → revision → transition → event → state → index → heartbeat, byte-for-byte snapshot/rollback) | `tests/task-state-checkpoint.test.mjs`, `tests/task-state-archive.test.mjs` |
| §11 `.figma/` CLI surface | `figma-skill/scripts/figma-task-state.mjs` (subcommands: `init-project`, `create`, `list`, `show`, `acquire`, `renew`, `takeover`, `release`, `checkpoint`, `todo-add`, `todo-update`, `evidence-add`, `screenshot-add`, `validate`, `archive`, `close`) | `tests/task-state-cli.test.mjs` |
| Naming grammar | `figma-skill/references/naming.md` (single authority) | `tests/naming-and-workflow.test.mjs` |
| Planning + Workflow 6 plan template | `figma-skill/references/planning.md` | covered by deterministic references routing, not a behavioural test |
| State + recovery + Mermaid | `figma-skill/references/state-and-recovery.md` | `tests/workflow-contract.test.mjs` (parses mermaid block, asserts Mermaid edges ≥ transitions) |
| Execution contract | `figma-skill/references/execution.md` (six-field eval/run, `figma-task-state.mjs` exemption, Geometry-aware Commands, `unstack --dry-run` semantics) | `tests/workflow-contract.test.mjs` (six fields, unstack labelled duplicate-origin only) |
| Geometry Verifier | `figma-skill/references/geometry-verifier.md` (`Lint → Duplicate-Origin → Top-Level AABB → Scoped Children AABB → Variant Parity → Visual`) | `tests/workflow-contract.test.mjs` (asserts ordered gates; `tests/figma-read-helpers.test.mjs` + `tests/figma-write-helpers.test.mjs` exercise actual scripts) |
| Validation & delivery | `figma-skill/references/validation.md` (three layers, terminal reclamation gate) | deterministic references routing |
| Installation & Yolo Connection Gate | `figma-skill/references/installation.md` (singular environment order) | `tests/workflow-contract.test.mjs` (asserts `--version → --help → status → connect` ordering) |
| Design system authority | `figma-skill/references/design-system.md` | routed via Mandatory Lookups in SKILL.md |

## 2. Mandatory Lookups Routing (Workflow → authority)

| Phase | Authority | Test method |
| --- | --- | --- |
| Workflow 1 (environment) | `references/installation.md` | `assertConnectOrder` in `tests/validate-skill.mjs` |
| Workflow 2 / 4G (design system) | `references/design-system.md` | routing in `tests/workflow-contract.test.mjs` |
| Workflow 0A / 4A–4H / 6 / 9–11 (discovery / plan / approval) | `references/planning.md` | routing in `tests/workflow-contract.test.mjs` |
| Workflow 6 / 7 / 8 (writes) | `references/execution.md` | six-field contract test |
| Workflow 9 / 10 (geometry verification) | `references/geometry-verifier.md` | ordered-gate test |
| Workflow 11 (delivery / terminal reclaim) | `references/validation.md` | archive-status test in `tests/task-state-archive.test.mjs` |
| Any phase, naming | `references/naming.md` | `tests/naming-and-workflow.test.mjs` |
| Any phase, persistence | `references/state-and-recovery.md` | `tests/workflow-contract.test.mjs` mermaid parser |

## 3. Deterministic Test Suite

| File | Coverage |
| --- | --- |
| `tests/task-state-schema.test.mjs` | Strict schema ↔ model parity, including `event.details.priorStatus` / `nextStatus` enum coverage |
| `tests/task-state-cli.test.mjs` | `init-project` (idempotent, fail-closed, schema mismatch), `create` (semantic slug + collision), `list`, `show` (malformed/invalid-input fail closed), `validate` |
| `tests/task-state-lease.test.mjs` | Expiry / renewal / takeover / `LEASE_LOST` / event-write rollback / E-#### monotonic IDs |
| `tests/task-state-checkpoint.test.mjs` | `COMPLETED` requires evidence, `TODO_UPDATED` recognition, lease + checkpoint gates, revision-after-success |
| `tests/task-state-archive.test.mjs` | Terminal cleanup, archive-status transitions, screenshot isolation, lease retention, `ARCHIVE_FAILED` |
| `tests/task-state-evidence.test.mjs` | Redaction + SHA-256 + monotonic `EV-####` IDs + screenshot containment |
| `tests/figma-read-helpers.test.mjs` | Empty `PARENT_ID` / `PARENT_IDS`, limitation issues, strict inequality, common envelope |
| `tests/figma-write-helpers.test.mjs` | `PLANS` / `BASELINE_REVISION` / `PARENT_ID` defaults, preflight, reverse rollback, common envelope |
| `tests/figma-validate-bounds.test.mjs` | Missing references, negative dims, root mismatch, config/figma-json exclusion |
| `tests/install-figma-cli.Tests.ps1` | InstallRoot validation, SHA-256 mismatch rejection, source-fallback plan |
| `tests/naming-and-workflow.test.mjs` | Naming authority + Workflow routing + Task types + Geometry keywords |
| `tests/workflow-contract.test.mjs` | v2 routing, gates, eval/run fields, screenshot path, mermaid, status transition contract |
| `tests/validate-skill.mjs` | Required files + v2 wording + scenario coverage + SKILL.md size budget |

## 4. Pressure Scenarios

| Section | Spec scenarios | Status |
| --- | --- | --- |
| §10 Pressure scenarios | S1–S13 | deterministic marker coverage only (test names cited above). Behavioural repetition deferred; recorded in `tests/v2-green-results.md`. |
| §10 Multi-step Geometry | S15.1 / S15.2 / S15.3 | scenario rows + oracle coverage in `tests/scenarios.md` and `tests/expected-behaviors.md` |
| §10 v2 persistence scenarios | S16–S25 | `tests/scenarios.md` adds S16–S25 (true v2 focus), `tests/expected-behaviors.md` adds matching rows, `tests/v2-baseline-results.md` documents the no-skill baseline outcome (10 PASS / 0 FAIL) |
| §11 v2 behavioral coverage | fresh-context pressure for S1–S13, S15.1–S15.3, S16–S25 + 6×5 micro-tests | recorded in `tests/v2-green-results.md` (scaffold-only pending subagent re-enable) |
| §11 cross-session E2E | disposable Figma `Nono` rehearsal | `tests/v2-e2e-results.md` (acceptance criteria scaffolded, pending subagent re-enable) |

## 5. Spec Resolution Notes

- v1.2 SKILL line numbers were replaced with stable heading anchors (`##`, `###`) and export / schema names; no line numbers appear above.
- `references/discovery-and-planning.md` was removed; its content migrated into `references/planning.md`.
- `references/naming.md` is new and is the single naming authority.
- `tests/workflow-contract.test.mjs` enforces SKILL.md ≤ 450 lines / ≤ 1800 words; current SKILL.md is well within that budget.
- Behavior scenarios are recorded as PASS only where deterministic coverage or behavioral evidence exists.
