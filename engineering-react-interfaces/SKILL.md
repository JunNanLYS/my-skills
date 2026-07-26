---
name: engineering-react-interfaces
description: Use when building, refactoring, reviewing, or accepting React and TypeScript interfaces where responsive layout, visual quality, accessibility, runtime performance, overflow or clipping safety, and release confidence matter.
version: 1.3
---

# Engineering React Interfaces

## Overview

Build interfaces as observable systems, not screenshots that happen to compile. A successful delivery is simultaneously correct, visually intentional, responsive, accessible, performant, and proven in a running browser.

**Core principle:** implementation evidence and acceptance evidence are different. Code, comments, types, and a successful build cannot prove that a layout does not overlap, clip, overflow, shift, or fail at another viewport.

## Required references

For non-trivial interface work, read every reference below before implementation. For a narrow change, read the matching reference plus `references/acceptance.md`.

| Work involved | Required reference |
|---|---|
| New page, redesign, screenshot/Figma recreation, visual polish | [visual-direction.md](references/visual-direction.md) |
| Responsive layout, grids, app shells, sticky/fixed UI, dynamic content | [layout-and-responsive.md](references/layout-and-responsive.md) |
| React architecture, TypeScript, data states, rendering, bundle/runtime performance | [react-typescript-performance.md](references/react-typescript-performance.md) |
| Controls, dialogs, navigation, forms, keyboard, screen readers | [accessibility-and-interaction.md](references/accessibility-and-interaction.md) |
| Any completion, release, or “ready” claim | [acceptance.md](references/acceptance.md) |

Use [resilient-catalog.md](examples/resilient-catalog.md) when a concrete React + CSS example would reduce ambiguity. Use [evaluations.md](tests/evaluations.md) when testing or improving this skill.

## Non-negotiable delivery contract

### Implementation and refactoring tasks

Every substantial implementation or refactoring task follows this order:

1. **Inspect** — read project instructions, existing components, design tokens, routes, dependencies, and the actual reference material. Preserve established conventions unless the task explicitly changes them.
2. **Model** — state the page's audience, single job, content hierarchy, interaction states, data extremes, and target environments. Convert missing requirements into explicit assumptions.
3. **Design** — define a compact visual direction and a responsive geometry contract before styling individual components.
4. **Implement** — use semantic React + TypeScript, resilient CSS, complete UI states, and measured performance decisions.
5. **Run** — launch the real application. Exercise interactions and inspect the rendered DOM at target and adversarial sizes.
6. **Verify and repair** — run code checks, visual/geometry checks, accessibility checks, and performance checks. Fix failures, then repeat the relevant checks.
7. **Report evidence** — distinguish what passed, what was not run, and what remains risky. Planned checks, proposed commands, and expected outcomes are not evidence and never score as passed.

Do not collapse steps 5–7 into “the code looks correct.”

### Read-only review and acceptance tasks

Do not edit, implement, or claim an implementation status when the request is review-only.

1. Inspect the requested scope and applicable references.
2. Trace each finding to concrete source or rendered evidence.
3. Verify suspected defects when the environment permits; distinguish confirmed from plausible findings.
4. Report findings by severity with file/line, failure scenario, and minimal correction.
5. State review coverage and unverified areas. Use **No blocking findings**, **Findings remain**, or the repository's review vocabulary—not `Implemented` or `Accepted`—unless the task explicitly asks for release acceptance and the six gates were actually executed.


## Geometry invariants

Unless the product explicitly requires otherwise, the finished interface must satisfy all of these:

- The page has no accidental horizontal scroll at any supported viewport.
- Readable or interactive content is not clipped, covered, or hidden behind fixed/sticky UI.
- Components do not overlap at rest, during loading, after data resolves, or while controls expand.
- Each region has one deliberate scroll owner per axis; nested scrolling is justified and usable.
- Flex/grid children that must shrink can shrink; long text and intrinsic media cannot force the container wider.
- Images, video, charts, embeds, tables, and code blocks stay inside their assigned region.
- Loading, empty, error, partial, permission-denied, and success states preserve usable geometry.
- Focus indicators remain visible; zoom, translated copy, large numbers, and unbroken strings do not destroy layout.
- Fixed/sticky controls account for dynamic viewport units, safe areas, and obscured content.
- Layout transitions do not create avoidable cumulative layout shift.

`overflow: hidden`, arbitrary fixed heights, line clamping, and ellipsis do not prove these invariants. They are valid only when the hidden content is intentionally non-essential or remains available by another accessible path.

## React and TypeScript contract

- Keep TypeScript strict. Do not introduce `any`, unsafe assertions, or unvalidated external data to make errors disappear.
- Type boundaries: component props, API/domain data, reusable hooks, public functions, and state machines. Let clear local inference remain clear.
- Represent mutually exclusive async/UI states with discriminated unions or an equivalent impossible-state-safe model.
- Derive values instead of synchronizing duplicate state with effects.
- Keep render pure. Use stable semantic keys; never use array indices when identity can change.
- Handle async cancellation, stale responses, errors, retries, and empty results. Do not leave working-looking controls disconnected from behavior.
- Prefer semantic elements and platform behavior before recreating them with generic containers and ARIA.
- Follow the repository's styling and state-management approach. Do not add a library when CSS or existing infrastructure is sufficient.
- Memoize or virtualize because measurement identifies meaningful work, not because a component exists. Memoization has a cost.
- Reserve media space, request appropriately sized assets, lazy-load offscreen media, and avoid importing large feature libraries into the initial route without evidence.
- Respect `prefers-reduced-motion`; animate `transform` and `opacity` where possible; never animate layout merely to look sophisticated.

## Visual quality contract

A polished interface is not “white cards + Inter + indigo + soft shadow.” Before coding a new visual surface:

- Ground the design in a concrete subject, audience, and job.
- Define named color, type, spacing, radius, border, shadow, and motion tokens.
- Establish one clear hierarchy and one justified signature element; keep the rest restrained.
- Use real, domain-appropriate copy and data. Structure, labels, dividers, and decoration must encode meaning.
- Design all states as part of the same visual system, including loading, empty, error, disabled, selected, hover, focus, and pressed.
- Match density to task frequency and information volume. “More whitespace” is not automatically more premium.
- Critique whether the result could belong to any generic AI-generated product. If yes, revise the typography, composition, content, or signature.

## Responsive strategy

- Start from content constraints, not familiar device labels. Add breakpoints where the composition fails, not because a framework exposes them.
- Change composition when space disappears: reflow, reorder, collapse, disclose, or switch navigation patterns. Do not only shrink everything.
- Test immediately below and above each breakpoint.
- Prefer fluid constraints (`min()`, `max()`, `clamp()`, intrinsic grid, container queries) over collections of magic widths.
- Treat 320 CSS px as a default narrow stress case unless the product defines another minimum; also test short viewports and an ultrawide case.
- Tables and code may own local horizontal scrolling. The page itself may not hide overflow to conceal a defect.

## Performance strategy

1. Establish a baseline or state that none exists.
2. Identify the likely bottleneck: network, bundle, media, render frequency, main-thread work, DOM volume, layout/paint, or animation.
3. Apply the smallest targeted optimization.
4. Measure again in a production build and realistic data state.

Protect user-facing metrics and interactions, not abstract cleverness. Track Core Web Vitals where available, compare route bundle size with the project baseline, inspect render behavior for hot interactions, and stress realistic item counts. A successful build is not a performance result.

## Acceptance status vocabulary

For implementation/refactoring handoffs or explicit release acceptance, use exactly one status:

- **Implemented — validation pending:** code is written, but one or more required checks were not run.
- **Partially verified:** checks ran, but failures, unsupported environments, or material gaps remain.
- **Accepted:** all applicable acceptance gates passed with recorded evidence.

**Never use “production-ready,” “ready to ship,” “complete,” or equivalent when browser validation was skipped.** A release window, standard-looking code, easy rollback, or post-release monitoring does not convert untested behavior into evidence.

Final handoff shape:

```markdown
Status: Accepted | Partially verified | Implemented — validation pending

Implemented:
- [user-visible outcomes]

Evidence:
- Code: [commands and results]
- Browser/geometry: [viewports, states, observed results]
- Accessibility: [keyboard/semantics/automated checks]
- Performance: [build/bundle/runtime measurements]

Not verified / remaining risk:
- [explicit gaps, or “None within stated scope”]
```

## Quick reference

| Concern | Default action | Evidence required |
|---|---|---|
| Reference image/design | Extract hierarchy, tokens, assets, and responsive hypotheses before coding | Rendered comparison at representative sizes |
| Dynamic content | Test empty, typical, maximal, translated, unbroken, missing, slow, and error cases | No accidental clipping/overflow/overlap |
| Grid/flex | Define shrink/grow/min/max behavior explicitly | Narrow, breakpoint-adjacent, and wide inspection |
| Images/media | Reserve aspect ratio; use correct sizing and fallback | Slow/missing/portrait/landscape cases |
| Long list | Measure DOM/render/scroll cost; paginate or virtualize when justified | Production-profiled interaction |
| Forms/dialogs | Use semantic controls, focus order, error association, escape/restore behavior | Keyboard-only run and accessible names |
| Animation | One purposeful motion system; reduced-motion fallback | No essential information depends on motion |
| Completion claim | Use acceptance status vocabulary | Commands plus browser observations |

## Rationalizations that fail review

| Rationalization | Reality |
|---|---|
| “The CSS is standard, so it is safe.” | Standard properties can combine into broken geometry. Run the interface. |
| “The build passed.” | A build proves compilation/bundling, not visual, behavioral, accessibility, or runtime correctness. |
| “We can roll back.” | Reversibility limits impact; it does not supply pre-release evidence. |
| “Monitoring will catch it.” | Monitoring is detection after exposure, not acceptance. |
| “`overflow: hidden` prevents overflow.” | It may only hide inaccessible or missing content. Find and fix the source. |
| “Ellipsis handles arbitrary copy.” | Truncation is a product decision and must preserve access to essential content. |
| “Memoizing everything makes it fast.” | Memoization can add comparison work and complexity. Profile first. |
| “Desktop matches the screenshot.” | A responsive interface needs coherent compositions beyond the reference viewport. |
| “The library component is accessible.” | Composition, labels, focus management, and surrounding state can still break accessibility. |
| “No time to test.” | Report validation pending; do not relabel uncertainty as completion. |

## Red flags — stop the completion claim

- Browser or device preview was available but not used.
- No narrow viewport or breakpoint-adjacent size was inspected.
- Page-level horizontal overflow is hidden rather than explained.
- Fixed heights contain unknown or translated text.
- A flex/grid child lacks a shrink strategy while holding long content.
- Mobile navigation or a primary action disappears with no replacement.
- Controls update appearance but not data or behavior.
- Loading/error/empty states were omitted or only described in comments.
- Focus is clipped, lost, trapped, or restored incorrectly.
- A performance claim has no production measurement.
- The handoff says “ready” while listing unrun tests.

Any red flag means the status is not **Accepted**. Fix it or report the gap explicitly.
