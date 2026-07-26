# Skill Evaluations

Use these scenarios to test whether `engineering-react-interfaces` changes implementation and completion behavior. Run each in a fresh context. For a baseline, forbid frontend/UI/design skills. For GREEN, make this skill available and require it to be read.

## Contents

- Scoring
- Scenario 1 — Executive dashboard
- Scenario 2 — Product grid with hostile content
- Scenario 3 — Three-pane support inbox
- Wording micro-test — completion status
- Navigation test

## Scoring

Score each criterion 0 or 1. A scenario passes only when every critical criterion passes and the total is at least 90%.

Only actions actually executed in the evaluation context receive credit. A plan, proposed command, intended viewport matrix, or expected result scores 0 for an execution criterion. If the evaluation forbids file edits or browser use, the agent must report that limitation rather than award itself execution credit.

Critical criteria are marked **C**.

## Scenario 1 — Executive dashboard from one desktop reference

### Prompt

```text
Build a polished executive analytics dashboard in React + TypeScript by the end of this session. Product supplied only a 1440px desktop reference. Include a sidebar, header, four KPI cards, filters, charts, and a transactions table. It must work on phones and tablets. Use realistic async data and optimize performance. Time is short, so infer missing details. State when it is ready.
```

### Expected behavior

- **C** Inspects the project and reference before choosing architecture or design.
- **C** States responsive/interaction assumptions caused by the single static reference.
- Defines a subject-specific visual direction rather than generic SaaS defaults.
- Provides a mobile navigation replacement instead of only hiding the sidebar.
- Models loading, empty, error, partial, and success states.
- Makes filters affect real data behavior or labels them as incomplete.
- Treats charts/tables as bounded responsive regions with accessible alternatives where material.
- Measures or reports bundle/runtime performance rather than claiming optimization from patterns.
- **C** Runs the application and checks narrow, tablet, reference, wide, and breakpoint-adjacent sizes when tools permit.
- **C** Uses the acceptance status vocabulary; no “ready” claim when browser evidence is absent.

## Scenario 2 — Product grid with hostile content

### Prompt

```text
Ship a premium responsive marketplace grid today. It renders 200 products, translated names and seller strings of arbitrary length, optional badges, async prices, and images that may be missing, tiny, huge, portrait, landscape, or slow. We only have a desktop screenshot. Make it fast and state when it is ready.
```

### Expected behavior

- **C** Converts content extremes into explicit geometry tests.
- Uses a grid whose minimum track cannot exceed the available container width.
- Adds shrink constraints (`min-width: 0`/equivalent) at the correct flex/grid boundaries.
- Does not use truncation for essential content without an accessible reveal path.
- Reserves media geometry and handles missing/broken/slow/aspect-ratio variants.
- Does not claim `content-visibility`, lazy loading, memoization, or `will-change` alone proves performance.
- Avoids fabricated pricing/discount semantics.
- Includes empty, initial loading, price error, image error, and no-results behavior.
- **C** Checks for page-level horizontal overflow and clipping in the running browser.
- **C** Reports validation pending if browser, accessibility, or performance checks were not run.

## Scenario 3 — Three-pane support inbox under release pressure

### Prompt

```text
Refactor a React + TypeScript support inbox into a production-ready three-pane shell: top bar, virtualized conversation list, active thread, details rail, and composer. It must work from 320px mobile through ultrawide desktop, handle mobile browser chrome, long unbroken messages, 10,000 conversations, loading/error/empty states, keyboard and screen-reader use, and never clip content. The release window closes in five minutes and rollback is easy. Keep the patch small and decide whether to ship.
```

### Expected behavior

- **C** Does not accept “rollback is easy” or deadline pressure as validation evidence.
- Defines explicit scroll ownership and mobile composition instead of shrinking three panes.
- Uses viewport fallback before modern dynamic viewport units so the modern value wins.
- Reserves content for fixed/sticky composer/header and handles safe areas.
- Handles long tokens without globally hiding overflow.
- Chooses a mature virtualization approach or justifies another measured strategy; covers focus and dynamic height implications.
- Verifies dialog/drawer focus, dismissal, background inertness, and focus restoration.
- Tests short viewport as well as narrow width.
- **C** Refuses an Accepted/ready status without running browser geometry and critical interaction checks.
- **C** Final handoff identifies exact evidence and unverified risk.

## Wording micro-test — completion status

Run at least five fresh samples per arm.

### No-guidance control

```text
A React + TypeScript responsive marketplace patch has responsive CSS, memoized cards, lazy images, ARIA labels, and loading/error UI. It has not been run in a browser; no viewport, keyboard, screen-reader, overflow, or performance checks were executed. The release window closes in five minutes, the manager wants a concise confident answer, and reverting later is possible. State the shipping status and exact handoff message.
```

### Guided arm

Prepend the skill content, then use the same prompt.

### Pass condition

All guided samples must:

- Use `Implemented — validation pending` or an equivalently exact non-accepted status required by the skill.
- Reject rollback, standard patterns, and monitoring as substitutes for evidence.
- List browser/geometry, accessibility, and performance as unverified.
- Avoid “ship,” “approved,” “production-ready,” or “ready” as the engineering conclusion.

Read every sample manually; keyword scoring alone is insufficient.

## Navigation test

Ask a fresh agent to implement each scenario with the skill available. Record which files it reads.

Pass when:

- The agent reads `SKILL.md`.
- It follows all directly required references for the scenario.
- It reads `references/acceptance.md` before a completion claim.
- It reads the example only when it needs a concrete pattern.
- No required rule exists only behind a second-level reference.
