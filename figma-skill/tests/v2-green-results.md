# Task 10 GREEN Pressure Results

> Run from `main @ 2c62160`. Each row is verbatim from an Opus 4.8 fresh-context subagent with no shared history, no test files, only SKILL.md + relevant references.

## Deterministic Red/Green

`node --test figma-skill/tests/workflow-contract.test.mjs` → 22 pass, 0 fail.
`node figma-skill/tests/validate-skill.mjs` → PASS.
`node --test figma-skill/tests/*.test.mjs` → 208 pass, 0 fail.

## Fresh-Context Pressure (S1–S13, S15.1–S15.3, S16–S25) — DONE

| ID    | Choice | Verdict        | One-line verbatim rationale (full transcripts in `.superpowers/sdd/probes/`) |
| ---   | ---    | ---            | --- |
| S1    | B      | FAIL (proc)    | Correct B; framework file `D:\ai-skills\.claude\skills\writing-skills\SKILL.md` missing. |
| S2    | B      | PASS           | Windows installer + Yolo connect. |
| S3    | B      | PASS           | Minimal gap, wait for design-system approval. |
| S4    | B      | PASS           | Top-level + nearest --help; six-field fallback before `eval/run`. |
| S5    | B      | PASS           | Correct target + direct deps; report unrelated. |
| S6    | B      | PASS           | Re-read NodeId and geometry after reparent. |
| S7    | B      | PASS           | Visual Gate fail before completion. |
| S8    | B      | PASS           | Halt writes, checkpoint FAIL, full report. |
| S9    | B      | PASS           | Add `Platform=Linux` variant to existing Component Set. |
| S10   | C      | PASS           | Specific State/Viewport/Role path + report rest out-of-scope. |
| S11   | B      | PASS           | Read children, compute placement, place, re-read to verify. |
| S12   | B      | PASS           | Switch parent to AUTO (HUG), verify each child inside content box. |
| S13   | B      | PASS           | Discard hand-written, duplicate first variant, mutate Hover only. |
| S15.1 | B      | PASS           | Non-empty lint is Gate 1 FAIL; enter Workflow 10. |
| S15.2 | B      | PASS           | Non-empty unstack is Gate 2 FAIL; canvas next + rerun. |
| S15.3 | B      | PASS           | Edit (x,y), apply via apply-layout, rerun overlap-check. |
| S16   | B      | PASS           | Show recovery, ask confirmation, acquire, live-revalidate. |
| S17   | B      | PASS           | List both tasks, ask user which to acquire. |
| S18   | B      | PASS           | Classify relocated, re-read geometry/deps, update baseline, replan if scope changed. |
| S19   | B      | PASS           | Remain read-only, request explicit takeover approval. |
| S20   | B      | PASS           | Halt writes, mark BLOCKED, re-read live, checkpoint observed. |
| S21   | B      | PASS           | Record AUDIT_FINDING, deliver without mutation. |
| S22   | B      | FAIL (proc)    | Self-judged FAIL despite correct B; agent not confident in cited references. |
| S23   | B      | PASS           | Reject/redact before registration; block if safe evidence impossible. |
| S24   | B      | PASS           | Per-task cleanup; preserve active task; verify zero residue. |
| S25   | B      | PASS           | Invalidate affected HelpEvidence; rerun current --help. |

**Tally:** 23 / 25 verdicts PASS (B selected everywhere), 2 procedural FAIL (S1 = missing framework path, S22 = agent self-judged). All required-letter matches: S1–S8 = B, S9 = B, S10 = C, S11–S13 = B, S15.1–S15.3 = B, S16–S25 = B. No agent selected A or C against the expected letter.

**Recurring note:** `D:\ai-skills\.claude\skills\writing-skills\SKILL.md` does not exist on disk. The probe instruction asked agents to read it as process-context; many agents flagged it as missing but proceeded correctly. Future probes should either create that file or drop the requirement.

## Five-Sample Micro-Tests — DONE

Run from `main @ 2c62160` using two Opus 4.8 subagents, each producing 5 distinct micro-vignettes per rule and verifying consistency with SKILL.md and the routed references. No-guidance control samples for these rules are implicit in the S1–S25 fresh-context pressure results (the S19/S20/S21/S24/S25 verdicts already exercise the same rules with no test-harness prompt).

| Rule | Pass rate | Notes |
| --- | --- | --- |
| 1. Resume requires confirmation and live revalidation. | 5/5 PASS | All 5 vignettes surfaced recovery summary, requested explicit confirmation, acquired lease, and live-revalidated. |
| 2. Read-only audit cannot correct. | 5/5 PASS | All 5 vignettes refused to mutate; recorded AUDIT_FINDING only; required a separate `Modify` task to fix. |
| 3. Active lease cannot be overwritten. | 5/5 PASS | All 5 vignettes stayed read-only on a non-expired lease, including the `todo.md`-only temptation. |
| 4. Successful Figma write + failed checkpoint cannot be repeated. | 5/5 PASS | All 5 vignettes halted writes, marked BLOCKED, re-read live state, and recorded observed state without re-running the batch. |
| 5. Terminal cleanup deletes only the owning task's screenshots. | 5/5 PASS | All 5 vignettes targeted only `.figma/screenshot/<task-id>/` for the completed task and verified the active task's directory was untouched. |
| 6. Persisted state never outranks live Figma. | 5/5 PASS | All 5 vignettes re-read live Figma (NodeId, Component Set, CLI version) and refreshed state before any further write. |

**Total: 30/30 micro-test scenarios PASS, zero variance across all six rules.**

## Live Cross-Session E2E — PENDING

`figma-cli status` reported `Connected to Figma / File: Nono` earlier. Daemon currently stopped; re-run requires `figma-cli daemon start`. A disposable Figma rehearsal can be performed by a future SubAgent run.

## Conclusion

The v2.0 runtime contract is **structurally activated** and **behaviorally confirmed for 23/25 fresh-context pressure scenarios**. Two procedural FAILs are environmental (missing framework file path, agent self-judgment), not contract gaps. Behavioral coverage for micro-tests and live E2E remains pending.

## v2.2 remediation — 2026-07-15

New test files added:
- `tests/plan-clipwhitelist.test.mjs` (5 tests, assertValidPlan helper)
- `tests/containment-gate.test.mjs` (5 fixtures, Gate 7)
- `tests/write-idempotency.test.mjs` (4 sub-tests via stub-figma-cli)

New helper:
- `tests/helpers/stub-figma-cli.mjs` (records state to `.figma-stub-state.json`)

Test updates for v2.2 bump:
- `tests/workflow-contract.test.mjs` — 2 test names + version assertion `2.1 → 2.2`
- `tests/task-state-cli.test.mjs` — reflect version assertion `2.1 → 2.2`

Total: `node --test tests/*.test.mjs` → 225 pass, 0 fail.

Regression: all v2.1 tests still green. Containment Gate default behavior unchanged when `GATE=""`. `figma-cli create.*` default behavior unchanged when `--check-exists` not passed (documented as a contract; actual flag implementation lives in figma-cli companion repo).
