# Acceptance and Release Evidence

Use this reference before any claim that a React interface is complete, accepted, production-ready, ready to ship, or visually finished.

## Contents

- Evidence rule
- Acceptance plan
- Six gates
- Geometry stress matrix
- Browser workflow
- Status decision
- Handoff template
- Failure handling

## Evidence rule

A claim is only as strong as the evidence collected in the current environment. A validation plan, command that was not executed, expected outcome, checklist, code comment, prose description of omitted code, or self-score is not evidence. Record it under **Not verified / remaining risk**, not under **Evidence**.

| Evidence | Proves | Does not prove |
|---|---|---|
| Typecheck/build | Source transforms and bundles under that configuration | Correct behavior, layout, accessibility, runtime speed |
| Unit/component tests | Tested logic and rendered behavior in their environment | Real browser geometry or full integration |
| Source inspection | Likely intent and obvious defects | Actual computed layout or interaction |
| Screenshot | One visual state at one viewport | Keyboard, semantics, hidden states, performance |
| DOM/computed-style inspection | Rendered structure and geometry for that state | Other viewports/states |
| Automated accessibility scan | A subset of detectable violations | Complete keyboard/screen-reader usability |
| Profiler/Lighthouse/Web Vitals | Measured scenario in stated conditions | Every device/network/data state |

Never infer a stronger category from a weaker one.

## Acceptance plan

Before implementation, derive a small task-specific plan:

```markdown
Target environments:
- Viewports/browsers: ...
- Input/accessibility: ...
- Data/content extremes: ...

Critical workflows:
1. ...
2. ...

Budgets/baselines:
- Bundle: ...
- Performance: ...
- Visual reference/tolerance: ...

Applicable states:
- loading / empty / partial / error / success / disabled / selected / open overlays
```

If the project defines acceptance rules, they override generic defaults. If it defines none, use the matrices below and state assumptions.

## Six gates

### Gate 1 — Code health

Run the repository's applicable commands:

- Typecheck.
- Lint.
- Unit/component tests.
- Production build.

Record exact commands and outcomes. Warnings that indicate defects are not “clean.” Do not invent commands; inspect project scripts.

### Gate 2 — Functional behavior

Exercise every changed critical workflow in the running app:

- Primary actions produce the promised result.
- Filters/search/sort/pagination affect data correctly.
- Navigation and deep links work.
- Loading, empty, error, retry, and success states are reachable and usable.
- Destructive/pending actions handle repeat interaction.
- Console and relevant network requests show no unexplained errors.

A control that only updates local appearance but not product behavior fails this gate.

### Gate 3 — Geometry and responsive behavior

Inspect continuously and at the matrix below. At each target:

- No accidental page horizontal scroll.
- No overlap, clipping, obscured content, or unreachable controls.
- Scroll owners behave intentionally.
- Fixed/sticky UI does not cover content/focus.
- Long/translated/unbroken content fits its contract.
- Open overlays remain inside viewport and usable.
- State transitions do not cause harmful layout shift.

Use screenshots plus DOM/computed geometry inspection. A screenshot alone can miss offscreen overflow.

### Gate 4 — Visual quality

Compare the running UI with the brief/reference and visual system:

- Hierarchy, density, composition, and responsive transformations.
- Typography, spacing rhythm, alignment, palette, borders, shadows, icons, and motion.
- All states feel like one system.
- No generic placeholder content/assets or accidental template aesthetic.
- Focus/hover/selected/disabled/reduced-motion appearances are coherent.

If matching a source design, record the viewports compared and material deviations.

### Gate 5 — Accessibility

Run applicable checks:

- Accessibility tree / names, roles, states, relationships.
- Keyboard-only workflow and visible focus.
- Dialog/menu/drawer focus and dismissal.
- Form labels, instructions, errors, and announcements.
- Automated accessibility scan where available.
- Zoom/reflow and reduced motion.
- Screen-reader smoke test for critical workflows when environment permits.

Record unrun assistive-technology tests instead of claiming them passed.

### Gate 6 — Performance

Use a production build and realistic data:

- Compare initial/route bundle with the project budget or baseline.
- Inspect network/media loading and avoid request waterfalls.
- Measure the critical load/interaction path with available tools.
- Profile known hot React interactions when rendering is a concern.
- Stress realistic list/item counts and slow/missing media.
- Check for avoidable layout shift.

If no budget or baseline exists, report measured values and conditions without declaring them “good” solely from intuition.

## Geometry stress matrix

Adapt to the product, but do not remove a category silently.

### Viewports

| Category | Default case |
|---|---|
| Minimum narrow | 320 × 568 |
| Common phone | 375 × 812 |
| Tablet | 768 × 1024 |
| Short laptop | 1280 × 720 |
| Primary/reference | Brief-defined |
| Wide | 1920 × 1080 or wider |
| Breakpoint edges | 1 px below and above every composition breakpoint |

Also test landscape/short height when the interface has fixed headers, bottom bars, dialogs, drawers, or virtual keyboards.

### Content/data

- Empty/null optional content.
- Typical real content.
- 2–3× translated copy.
- Long unbroken token.
- Largest expected number/date/currency.
- Missing, broken, slow, portrait, and landscape media.
- Minimum and realistic maximum item counts.
- API delay, recoverable error, terminal error, partial data.

### Interaction states

- Default, hover, focus-visible, pressed, selected, disabled.
- Menus/dialogs/drawers/tooltips open near viewport edges.
- Validation errors and status messages visible.
- Navigation during pending work.
- Zoom/text enlargement where applicable.

## Browser workflow

Use the environment's real-app/browser tools where available.

1. Start the app using the project's supported launch mechanism.
2. Check server/build logs.
3. Open the exact changed route.
4. Inspect the accessibility tree for structure and text.
5. Exercise the primary workflow.
6. Resize through the matrix, including breakpoint-adjacent widths.
7. Inspect suspicious elements' bounding boxes and computed overflow/size/position.
8. Check console and failed network requests.
9. Capture representative screenshots.
10. Apply fixes in source, reload, and repeat failed checks.

Do not temporarily edit the DOM to “fix” the implementation; browser evaluation is for inspection. Modify source code and verify after reload.

## Status decision

Choose the final status mechanically:

### Accepted

Use only when:

- All applicable gates passed.
- No known material defect remains.
- Unavailable checks are outside the stated support contract; applicable checks were not waived or silently omitted.
- Evidence is recorded.

### Partially verified

Use when:

- Some checks ran, but a failure or material gap remains.
- A target environment or applicable check could not be tested, even when a release owner explicitly accepts the operational risk.
- A known deviation remains or was accepted as release risk without evidence that the gate passed.

### Implemented — validation pending

Use when:

- Code was written but the real app was not run, or
- Browser/geometry validation did not occur, or
- Only source/build evidence exists for a user-interface change.

No deadline or authority pressure changes these definitions. If an external release owner chooses to ship anyway, report that decision separately; do not rename the engineering status.

## Handoff template

```markdown
Status: Accepted | Partially verified | Implemented — validation pending

Implemented:
- [specific user-visible outcomes]

Evidence:
- Code: `[command]` — [result]
- Functional: [workflow/state exercised] — [result]
- Browser/geometry: [viewport + content/state cases] — [result]
- Visual: [comparison/inspection] — [result]
- Accessibility: [keyboard/tree/scan/AT checks] — [result]
- Performance: [build/runtime measurements and conditions] — [result]

Not verified / remaining risk:
- [specific gaps, or “None within stated scope”]
```

Keep claims exact. Say “keyboard path passed in Chromium” rather than “fully accessible.” Say “no horizontal overflow at tested widths” rather than “can never overflow.”

## Failure handling

When a gate fails:

1. Capture the exact viewport, state, action, and observed result.
2. Find the source constraint or behavior; do not hide the symptom.
3. Add an automated regression test when the defect is behaviorally testable.
4. Fix source code.
5. Re-run the failed case and adjacent cases.
6. Re-run any code gate affected by the fix.
7. Update evidence and status.

Stop and report a blocker only when required input or environment is genuinely unavailable. “No time” is a scope/status constraint, not verification evidence.
