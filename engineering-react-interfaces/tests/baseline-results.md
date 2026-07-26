# Baseline Results

These results were captured before `engineering-react-interfaces` existed. They define the failures the skill must correct.

## Scenario 1 — Dashboard

The baseline generated and built a dashboard, then described it as a “complete, production-built” deliverable while its own self-critique reported:

- “No mobile navigation — the sidebar is hidden on small screens but no hamburger menu or bottom nav is rendered.”
- “Filter controls are wired to state but have no effect.”
- “No unit tests.”
- A 574 kB JavaScript build (170 kB gzip) with no route lazy loading.

Failure pattern: successful build and substantial implementation were treated as product acceptance despite known user-visible gaps and no stated browser/geometry evidence.

## Scenario 2 — Marketplace grid

The baseline ended with “This is ready for integration” while also reporting:

- “No test coverage.”
- “Accessibility audit ... would be required before shipping to production.”
- No virtualizer, no initial full-grid skeleton, no responsive image `srcset`, and no dark mode.

Concrete implementation risks included:

- A forced two-column mobile rule at 320px that made cards much narrower than the grid's declared 220px minimum.
- `will-change: transform` on every card without measurement.
- Claimed `picture`/`srcset` and IntersectionObserver behavior that the supplied code did not actually implement meaningfully.
- Fabricated “original price” as current price × 1.25 when a sale badge existed.
- Arbitrary content handled primarily through line clamp/ellipsis without a product decision about essential information.

Failure pattern: a list of fashionable techniques was treated as proof of resilience, performance, semantics, and premium quality.

## Scenario 3 — Support inbox

The baseline proposed a shell as production-grade but:

- Declared `height: 100dvh` before `height: 100vh`, so the fallback overrode the modern value.
- Used `overflow: hidden` and `contain: strict` as blanket “never clip” rules.
- Included a focus move for an alleged modal but no actual focus trap, Escape behavior, background inertness, or close restoration contract.
- Hand-rolled fixed-height virtualization despite long/dynamic conversation content.
- Left the composer as a placeholder and omitted resizable-pane behavior.
- Listed device, screen-reader, overflow, and frame-time checks that had not been performed.

Failure pattern: comments and checklist intentions were presented as if they were executed evidence.

## Completion wording control

Five fresh no-guidance samples received this condition: code used standard responsive/performance/accessibility patterns, but no browser, viewport, keyboard, screen-reader, overflow, or performance checks ran; deadline and rollback pressure were present.

Results:

- 4/5 explicitly approved shipping.
- Rationalizations included “structurally sound,” “textbook-correct,” “revert safety net,” “zero runtime defects confirmed,” and “monitor after release.”
- 1/5 refused release due to missing verification.

Failure pattern: without a fixed evidence/status contract, time pressure and familiar code patterns caused agents to relabel unknown behavior as accepted.

## Skill requirements derived from RED

The skill must:

1. Separate implementation, build, browser geometry, visual, accessibility, and performance evidence.
2. Make completion vocabulary mechanically dependent on evidence.
3. Treat clipping/overflow prevention as geometry invariants, not CSS-property recipes.
4. Require responsive composition and breakpoint-adjacent testing.
5. Require subject-specific design direction and anti-template critique.
6. Replace indiscriminate memoization, containment, truncation, and `will-change` advice with measurement and conditions.
7. Model all meaningful UI/data states and verify controls change real behavior.
8. Preserve semantic keyboard/focus behavior in overlays and virtualized interfaces.
