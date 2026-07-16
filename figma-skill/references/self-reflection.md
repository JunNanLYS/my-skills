# Self-Reflection Block

Self-Reflection Block is the final maintenance artifact for figma-skill v3 tasks. It does not mutate Figma and does not change PlanWeave task state.

## Purpose

Record concrete problems observed while using this skill and actionable improvements for future skill maintenance.

## Storage Path

```text
<Current workspace>/.figma/feedback/<timestamp>.md
```

`<timestamp>` uses file-name-safe ISO 8601 local time: `YYYY-MM-DDTHH-MM-SS`. The filename contains only the timestamp unless a same-second collision requires a numeric suffix.

## Required File Structure

```markdown
# figma-skill v3.0 Self-Reflection
<!-- skill-version: 3.0 -->

## 1. Problems

| # | Problem | PlanWeave Block or Gate | Impact |
| - | ------- | ----------------------- | ------ |
| 1 | A concrete observation from this task. | <block-or-gate> | Observable impact. |

## 2. Optimization Directions

| # | Direction | Priority | Related Problem |
| - | --------- | -------- | --------------- |
| 1 | A concrete change that can be made to the skill or tests. | P1 | Problem #1 |
```

Requirements:

- Both tables must exist.
- Each table must contain at least one row.
- Priority must be `P0`, `P1`, or `P2`.
- Related Problem references must point to a row in the Problems table.
- The file must not include daemon tokens, credentials, authorization headers, or sensitive absolute paths.

## Failure Handling

If the reflection file cannot be written safely, report the failure in the Delivery Block and mark the Self-Reflection Block as failing. Do not hide the failure by claiming task completion.
