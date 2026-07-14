# v2 Live Cross-Session E2E Results

> Status: PENDING. The actual disposable Figma rehearsal was deferred alongside the fresh-context pressure and micro-test runs; without a SubAgent with sufficient quota we did not double-allocate the live Figma file. Pre-recorded acceptance criteria listed below so a future Fable agent can replay them once budget allows.

## Required Acceptance Criteria

A Task 10 E2E run must produce all of:

1. Two distinct session identifiers (e.g., `session-a`, `session-b`) demonstrating cross-session handoff.
2. Session A:
   - `figma-task-state.mjs init-project` (already done at baseline);
   - `create --task 2026... --type Modify --write-required true`;
   - one temporary frame created via `figma-cli create frame` with a unique name (e.g., `e2e-canary-20260714`);
   - `acquire` + one `checkpoint` (validates writeRequired gate, transitions, revision increment to 1, lease heartbeat);
   - `release` without archiving.
3. Session B (fresh context, no shared in-memory state):
   - `list` returns Session A's task;
   - `show` reads Session A's `recovery.md` and `state.json`;
   - `acquire` (re-acquire or takeover depending on whether Session A released);
   - live revalidation via `figma-cli inspect --json <nodeId>` and overlap-check;
   - completes remaining Todos via further `checkpoint`s (must include `TODO_UPDATED` events with `EV-####` evidence references);
   - records `state.validation.visual.summary` based on actual screenshot inspection;
   - `archive` (which deletes only Session A's screenshots directory and writes `final-summary.md`);
   - verifies `.figma/screenshot/<task-id>/` is absent for Session A but intact for any other active task;
   - verifies `state.archiveStatus === ARCHIVED` and `lease.json` removed;
   - `close` after `ARCHIVED` succeeds.
4. Evidence files (committed in `figma-skill/tests/v2-e2e-results.md`):
   - Session A & B IDs;
   - checkpoint revisions observed per session (initial 0; +1 per write batch);
   - Gate outputs concatenated: `lint --json`, `unstack --dry-run`, helper-script JSON envelopes (signed task ID and holder for each);
   - `state.json` before and after archive (showing `archiveStatus` flip and `taskType` retention);
   - `final-summary.md` content (truncated to remove any home paths or tokens);
   - one-line Git diff summary covering the Task 10 commit.
5. No token, no absolute home path, no script-level secret appears in the E2E file.

## Why this is deferred

After the Task 10 implementation agent (Opus) was terminated early due to insufficient account balance, the live test was not performed automatically. The v2.0 runtime contract is structurally activated (208 Node tests, 22 workflow-contract tests, validate-skill PASS) so subsequent agents can take over the E2E step without rework.

## Replay Instructions

A future agent that can spawn SubAgents should:

1. Ensure `figma-cli status` confirms connection to a disposable file (e.g., `Nono`).
2. From a fresh-context Sonnet session, run two distinct session-id agents through the steps above.
3. Capture evidence to this file with the acceptance criteria satisfied.
4. Add tests for any unexpected branch behavior that emerges; do not relax the existing contract assertions.
