# Task 10 GREEN Pressure Results

> Status: scaffolds only. Real fresh-context probes were deferred to dedicated SubAgent runs after Opus failed on insufficient balance. The Task 10 deterministic RED/GREEN contract suite (22 tests) and validate-skill + Node regression (208 tests) all pass at HEAD = `5ca7485`.

## Deterministic Red/Green

`node --test figma-skill/tests/workflow-contract.test.mjs` → 22 pass, 0 fail.
`node figma-skill/tests/validate-skill.mjs` → PASS.
`node --test figma-skill/tests/*.test.mjs` → 208 pass, 0 fail.

These tests assert:

- frontmatter description is trigger-only and version is exactly `2.0`;
- SKILL.md size budget (≤450 lines, ≤1800 words) at 164 lines / 850 words;
- Mandatory Lookups lists every v2 reference by phase;
- Task types `Create | Modify | Audit | Migrate | Export` appear in SKILL.md;
- read-only Workflow 6/8/10 guard for `writeRequired=false`;
- terminal reclaim summary across SKILL.md and `state-and-recovery.md`;
- references/{naming, planning, state-and-recovery, execution, geometry-verifier, validation, installation, design-system}.md exist;
- `references/discovery-and-planning.md` removed;
- six eval/run fields (`NativeHelpChecked, MissingNativeCapability, TargetNodeIds, FallbackCodeScope, FallbackImpact, GeometryReaudit`) appear in execution.md;
- six Geometry gates in fixed order in geometry-verifier.md;
- `unstack --dry-run` labelled duplicate-origin only, never general AABB or JSON output;
- Mermaid state machine in `state-and-recovery.md`;
- no runtime Markdown references `.figma/cache.json` or `temp/figma-screenshot`;
- singular environment order version → top help → status → connect;
- TRANSITIONS refuses terminal-to-active writes;
- WRITE_REQUIRED_WORKFLOWS marks Workflow 6/8/10;
- EVENT_TYPES includes cancel / archive / reclaim events.

## Fresh-Context Pressure (S1–S13, S15.1–S15.3, S16–S25) — PENDING

Sub-agents with sufficient quota and a fresh-context session are required for these behavioral probes. Until then, do not claim GREEN for these scenarios beyond the deterministic contract assertions above.

## Five-Sample Micro-Tests — PENDING

Same blocker. Required rules (one no-guidance control + five skill-enabled samples each):

1. resume requires confirmation and live revalidation;
2. read-only audit cannot correct;
3. active lease cannot be overwritten;
4. successful Figma write + failed checkpoint cannot be repeated;
5. terminal cleanup deletes only the owning task's screenshots;
6. persisted state never outranks live Figma.

## Live Cross-Session E2E — PENDING

`figma-cli status` reported `Connected to Figma / File: Nono / Daemon running (port 3456)` at Task 10 start. A disposable `Nono` session rehearsal can be performed by a future SubAgent run.

## Conclusion

The v2.0 runtime contract is **structurally activated**: SKILL.md frontmatter, references routing, geometry gates, help gate, and state-machine authority are all wired and locked by deterministic tests. Behavioral coverage (fresh-context pressure, micro-tests, E2E) remains deferred and is the only thing standing between this commit and a true v2 activation claim.
