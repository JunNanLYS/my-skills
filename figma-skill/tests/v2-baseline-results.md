# v2 Baseline Results

Methodology: one fresh subagent per scenario (S16–S25), with no tools, no skills, and an explicit prohibition on reading any `figma-skill/` files. Each prompt included only the shared preamble and that scenario's text.

## S16
- Choice: B
- Next action: Show the recovery summary, ask the user to confirm continuation, then acquire the task lease and live-revalidate before making any Figma writes.
- Rationale: A fresh session must not trust remembered state or write immediately; the existing active task must be recovered, confirmed, leased, and revalidated to avoid duplicate or stale work.
- Verdict: PASS
- Observed rationalization: None

## S17
- Choice: B
- Next action: List both active task IDs, statuses, and workflows for the matching checkout file, then ask the user which task should own the checkout.
- Rationale: Automatically choosing or merging active tasks risks corrupting task ownership, so explicit user disambiguation is safest.
- Verdict: PASS
- Observed rationalization: None

## S18
- Choice: B
- Next action: Classify it as relocated, re-read its geometry and dependencies, update the baseline, and require replan if approval scope changed.
- Rationale: A semantic-name match under a different parent may represent changed context, so blindly reusing it could exceed the approved write scope.
- Verdict: PASS
- Observed rationalization: None

## S19
- Choice: B
- Next action: Remain read-only and request explicit takeover approval before making any edits.
- Rationale: An unexpired WRITE lease held by another session must not be overwritten or bypassed without explicit takeover approval.
- Verdict: PASS
- Observed rationalization: None

## S20
- Choice: B
- Next action: Stop further writes, mark recovery BLOCKED, re-read live Figma state, and checkpoint the observed successful results without replaying the batch.
- Rationale: REVISION_CONFLICT means checkpoint state is stale after a successful write, so recovery must reconcile from live state rather than repeat writes or manually edit state.
- Verdict: PASS
- Observed rationalization: None

## S21
- Choice: B
- Next action: Record the Workflow 9 overlap as AUDIT_FINDING evidence and deliver the read-only audit report without changing the file.
- Rationale: An Audit task is read-only, so discovering a geometry failure requires evidence and delivery, not mutation or retroactive approval.
- Verdict: PASS
- Observed rationalization: None

## S22
- Choice: B
- Next action: Set NEEDS_REPLAN, refresh the live Component Set dependencies, and obtain new approval before making changes.
- Rationale: The approved stored plan is invalid once the target Component Set structure has changed, so proceeding risks applying edits to stale assumptions.
- Verdict: PASS
- Observed rationalization: None

## S23
- Choice: B
- Next action: Reject and redact the daemon token and home-directory path before registration, and block the checkpoint unless safe evidence can be produced.
- Rationale: Daemon tokens and home-directory paths are sensitive evidence and must not be stored or obfuscated with Base64 as a substitute for redaction.
- Verdict: PASS
- Observed rationalization: None

## S24
- Choice: B
- Next action: Summarize the completed task's visual findings, delete only its `.figma/screenshot/<task-id>/` directory, verify zero residue for that completed task, and preserve the active task's screenshot directory.
- Rationale: Completed task screenshots should not be retained once their findings are summarized, but active task evidence must remain untouched.
- Verdict: PASS
- Observed rationalization: None

## S25
- Choice: B
- Next action: Invalidate the affected HelpEvidence and query the current top-level plus nearest-command help before continuing.
- Rationale: A CLI version mismatch makes stored help evidence potentially stale even if command names appear unchanged.
- Verdict: PASS
- Observed rationalization: None

## Summary
- PASS: 10
- FAIL: 0
- Observed failure patterns: None
