# GREEN and REFACTOR Results

This file records deterministic and behavioral coverage for every figma-skill release. Behavioural evidence is captured in dedicated evidence files (linked below). Marker presence is never counted as behavioral coverage.

## Run Index

| Release | Deterministic | Behavioral — fresh-context pressure | Behavioral — micro-tests | Behavioral — cross-session E2E |
| --- | --- | --- | --- | --- |
| v1.2  | `validate-skill.mjs`, `naming-and-workflow.test.mjs`, `figma-validate-bounds.test.mjs`, `install-figma-cli.Tests.ps1` | deferred in v1.2 era | n/a | n/a |
| v1.2.1 / v1.2.3 / v1.2.4 | same suite, plus helper scripts and `assertGeometryVerifierStrict` | deferred | n/a | n/a |
| v2.0  | same suite, plus `workflow-contract.test.mjs`, fresh `task-state-*` coverage (208 / 208 PASS) | pending — see `v2-green-results.md` | pending — see `v2-green-results.md` | pending — see `v2-e2e-results.md` |

## v2.0 Deterministic Run

```bash
node figma-skill/tests/validate-skill.mjs
node --test figma-skill/tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File figma-skill/tests/install-figma-cli.Tests.ps1
for f in figma-skill/scripts/*.mjs figma-skill/scripts/lib/task-state/*.mjs; do node --check "$f"; done
git diff --check
```

Observed at HEAD `40db918 feat(figma-skill): activate v2 persistent workflows`:

- `validate-skill.mjs` → PASS
- `node --test` → tests 208 pass, 0 fail, 0 cancelled
- PowerShell installer → PASS (Stage 1 baseline)
- `node --check` for every modified/created `.mjs` → silent success
- `git diff --check` → silent success

## v2.0 Evidence Files

- Baseline (no-skill fresh contexts): `figma-skill/tests/v2-baseline-results.md`
- Pressure run plan + results:        `figma-skill/tests/v2-green-results.md`
- Cross-session E2E plan + results:   `figma-skill/tests/v2-e2e-results.md`

## REFACTOR Notes

- The legacy `assertGeometryAndLookups` / `assertConnectStatusGate` / `assertHelpDiscoveryGate` helpers were retired from `tests/validate-skill.mjs`; `assertRuntimeContract` / `assertConnectOrder` / `assertHelpDiscovery` replace them with v2 wording.
- The legacy `tests/naming-and-workflow.test.mjs` SKILL-grammar assertions moved to `references/naming.md` plus a small SKILL.md routing check.
- `assertNamingAndWorkflow` now accepts three arguments (skill, runtime, refs) and resolves every marker from the live authority file (naming.md or state-and-recovery.md).
- Task 10 activated v2 by rewriting SKILL.md to 2.0 (164 lines / 850 words) with Mandatory Lookups, the Mermaid state machine, and the terminal reclamation gate.
- Future validator drift (e.g., ordering, regex tightening) must be fixed in `validate-skill.mjs` before commit; this file is not a checklist.

## Outcome

- v2.0 is **structurally activated** (commit `40db918`); deterministic suite plus references routing + state machine + Geometry gate ordering are all wired and locked.
- v2.0 **behavioral coverage is pending** and documented in `tests/v2-green-results.md` and `tests/v2-e2e-results.md` until a SubAgent with sufficient quota resumes the fresh-context probes.
