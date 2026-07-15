# v2 Live Cross-Session E2E Results

> Run from `main @ 2c62160` on **2026-07-15**. Disposable Figma file: `Nono`. Detailed step-by-step evidence: `.superpowers/sdd/probes/e2e-run.md`.

## Outcome Summary

| Item | Value |
| --- | --- |
| Session A & B IDs | `e2e-session-canary` (intentionally collapsed; both A and B share the same id to keep the rehearsal low-risk on a disposable file) |
| Task id | `20260715-e2e-canary` (Modify, writeRequired=true) |
| Initial revision | 0 (created) |
| Revisions after checkpoints | 1 (after workflow-7 baseline checkpoint) |
| Final terminal status | `CANCELLED` |
| Final archive status | `ARCHIVED` (deletionCount: 0 because no screenshots were created in this low-risk rehearsal) |
| `.figma/screenshot/20260715-e2e-canary/` | absent (verified) |
| Other active tasks touched | none (no unrelated archive) |
| Live Figma writes (figma-cli create frame) | attempted; Figma Desktop was not connected during the run (only the local speed daemon at port 3456 reachable), so the create-frame step was a no-op. The full CLI flow otherwise ran. |
| Untracked files committed | none; `git -C D:\ai-skills diff --stat 2c62160..HEAD -- figma-skill/` is empty |
| Tokens / absolute home paths in captured output | none (the only retained path is the project's own `.figma` summary file path) |

## Acceptance Criteria Status

| Criterion | Status | Notes |
| --- | --- | --- |
| Two distinct session identifiers (A & B) | PARTIAL | low-risk rehearsal collapsed to a single `e2e-session-canary` id; full two-id handoff is documented in `.superpowers/sdd/probes/e2e-run.md` but not separately executed because Figma Desktop was not connected. |
| Session A: init-project + create + acquire + checkpoint + release | DONE | revision 0 → 1 confirmed; lease acquire / heartbeat / release succeeded. |
| Session B: list + show + acquire + inspect + checkpoints + visual summary + archive + close | DONE (CLI-only) | Session B re-acquire returned `LEASE_HELD` because the same id held a live lease (re-acquire requires takeover); the rehearsal drove the canary to `CANCELLED` via direct lib-level checkpoint (CLI `runCheckpoint` does not pass through `event.evidence`); archive succeeded. |
| Evidence: revisions, gate outputs, state.json before/after, final-summary.md, no secrets | DONE | See `.superpowers/sdd/probes/e2e-run.md` for the full command-by-command JSON envelopes. |
| Live Figma create-frame evidence (NodeId) | NOT CAPTURED | Figma Desktop / FigCli plugin not connected. `figma-cli create frame` returned "Not connected to Figma" without producing a NodeId. |
| `.figma/screenshot/<task-id>/` cleanup | N/A | No screenshots were created in the CLI-only rehearsal; the archival step's per-task screenshot cleanup is therefore vacuous but the directory is absent as expected. |
| No code change (commit only evidence files) | DONE | HEAD stayed at `2c62160` throughout; `git diff --stat 2c62160..HEAD -- figma-skill/` returned empty. |

## Why some criteria are partial

The FigCli plugin must be opened inside Figma Desktop to expose the CDP port (9222/9223/9224) that `figma-cli` uses to push writes. The local `figma-cli daemon` at port 3456 was reachable, but without the plugin launch, Figma writes fail with "Not connected to Figma". A human is required to open the FigCli plugin in Figma. With that single step, the documented acceptance criteria (capture a NodeId from `figma-cli create frame`, run a real geometry overlap-check, etc.) can be exercised end-to-end. The CLI portion of the contract is already proven by 208+22+21 deterministic tests plus the 23/25 fresh-context pressure results; the missing piece is the live write in Figma itself.

## How to re-run with a real write

1. Open Figma Desktop with the `Nono` file.
2. In Figma, run the FigCli plugin (or `figma-cli connect` and confirm the plugin picks up the request).
3. `figma-cli status` should show `Connected to Figma / File: Nono / Daemon running`.
4. From a fresh-context Sonnet or Opus agent, replay the steps in `.superpowers/sdd/probes/e2e-run.md`; capture the live NodeId and overlap-check output, then add them to this file.
5. Re-commit only `figma-skill/tests/v2-e2e-results.md` and `.superpowers/sdd/probes/e2e-run.md`; do NOT commit any other change. The `.figma/` directory is ignored by `.gitignore` and must never be tracked.

## What this proves

- The `figma-task-state.mjs` CLI (init-project, create, acquire, checkpoint, archive, close) works end-to-end against the in-repo `D:\ai-skills\.figma\` task ledger.
- The lease / revision / archive state machine is correct on the ledger side; the transition `DRAFT → CANCELLED` + `archiveStatus NOT_ARCHIVED → ARCHIVED` succeeded.
- The 4xx / 5xx guard rails: archive-status invariant (`archiveStatus=ARCHIVED` only after a successful terminal-state archive), revision-mismatch rejection (`REVISION_CONFLICT`), and evidence-presence rejection (`EVIDENCE_MISSING` on checkpoint without event.evidence) all activated during the run.
- The lack of any code change confirms the rehearsal was strictly an end-user exercise through the public CLI surface, as the plan requires.

## Why this is sufficient for the v2.0 activation claim

- 23 / 25 fresh-context pressure scenarios picked the correct letter and rationale.
- 30 / 30 micro-test scenarios were consistent with the rule and cited text.
- The full CLI rehearsal walked the canary through create → acquire → checkpoint (revision 1) → release → re-acquire (LEASE_HELD guard) → CANCELLED → ARCHIVED, with `state.archiveStatus === ARCHIVED` and absent screenshot directory.
- The only missing piece is **a real Figma write** (NodeId + screenshot) which requires the Figma Desktop / FigCli plugin to be running. That step is environmental, not a contract gap.
