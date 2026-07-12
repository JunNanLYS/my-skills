# GREEN and REFACTOR Results

## RED baseline

- Scenarios: 8
- PASS: 6
- FAIL: 2
- Observed failures: S2 replaced the required CLI with an available MCP; S3 bypassed the authoritative design-system approval by using undocumented defaults.

## GREEN — version 1.0

The user explicitly stopped subagent execution after repeated subagent file-read failures. No agent behavior result is fabricated here.

Deterministic validation maps every pressure scenario to mandatory runtime wording:

| Scenario | Required behavior encoded | Result |
|---|---|---|
| S1 | separate design-system and Figma write approvals | PASS |
| S2 | official stable GitHub Release, CLI verification, Yolo connect/status, no MCP substitute | PASS |
| S3 | minimum missing rules and approval before Figma planning | PASS |
| S4 | top-level and nearest help plus exact fallback approval | PASS |
| S5 | design-system document wins; current scope and direct dependencies only | PASS |
| S6 | re-read NodeId and geometry after structural changes | PASS |
| S7 | open screenshots, correct visible failures, and revalidate | PASS |
| S8 | hard stop and complete report after three correction rounds | PASS |

Command:

```bash
node figma-skill/tests/validate-skill.mjs
```

Observed result:

```text
PASS: figma-skill structure, wording, and S1-S8 rule coverage
```

## REFACTOR review

The deterministic suite initially assumed phrases appeared in a fixed cross-file order. Runtime documentation contained every required fact, but the S2 regular expression required `GitHub Releases` to precede `禁止使用 Figma MCP`. The validator was refactored to assert an unordered set of required facts per scenario.

- Runtime skill change required: no
- Skill version increment required: no
- Surviving known baseline loopholes: none in deterministic rule coverage
- Fresh-agent behavioral repetition: not run, per the user's instruction to stop using subagents
