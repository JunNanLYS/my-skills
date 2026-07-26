# GREEN and REFACTOR Results

## Summary

The skill changed both implementation reasoning and completion claims.

### Completion wording micro-test

| Arm | Correctly withheld acceptance | Common behavior |
|---|---:|---|
| No-guidance control | 1/5 | 4/5 approved shipping because patterns looked standard, rollback existed, or monitoring could catch defects |
| Skill-guided | 5/5 | All used `Implemented — validation pending`, separated engineering status from a release-owner decision, and listed missing browser/accessibility/performance evidence |

Result: the fixed acceptance vocabulary and evidence contract eliminated the observed shipping rationalizations in five fresh samples.

## Scope of this evidence

These are prompt-behavior evaluations: the agents were intentionally prevented from editing a host application, so browser-dependent execution criteria score 0. The results show that the skill changes reasoning and status reporting; they do not claim that any full implementation scenario passed the 90% acceptance threshold.

## Scenario results

### Dashboard

Improvements over baseline:

- Added a mobile drawer instead of hiding navigation.
- Modeled loading, empty, error, and success states.
- Wired filters conceptually to URL/data parameters rather than appearance-only state.
- Used a subject/audience/job design brief and compact token system.
- Rejected a ready/Accepted claim without browser evidence.

New loophole:

- The response gave itself credit for “runs the application and checks multiple viewports” because its plan listed those viewports, although no application or browser was available.

Refactor:

- Added the rule that planned checks, proposed commands, expected outcomes, prose descriptions, and self-scores are not evidence.
- Evaluation scoring now gives execution criteria 0 unless the action actually ran.

### Marketplace grid

Improvements over baseline:

- Used `minmax(min(100%, 17rem), 1fr)` rather than forcing two narrow mobile columns.
- Added `min-inline-size: 0` at intrinsic-size boundaries.
- Reserved media geometry and handled absent/broken/slow/aspect-ratio variants.
- Avoided fabricated discounts and indiscriminate `will-change`/memoization claims.
- Correctly scored the unrun browser-overflow criterion 0 and kept validation pending.

New loophole:

- The response treated the HTML `title` attribute as a reliable keyboard/assistive-technology path to ellipsized seller text.

Refactor:

- The example now wraps essential seller text.
- Accessibility guidance states that `title` is supplementary, not a reliable disclosure mechanism for truncated essential text.

### Support inbox

Improvements over baseline:

- Refused release despite deadline and rollback pressure.
- Defined responsive composition and scroll ownership.
- Put `100vh` before `100dvh` so modern dynamic viewport units win.
- Addressed safe areas, long tokens, virtualization implications, focus, and short viewports.

New loopholes:

- The proposed JSX used the HTML `hidden` attribute for mobile state while expecting desktop CSS to restore the pane. `hidden` removes it in every viewport unless deliberately overridden, making the state contract brittle/wrong.
- The self-score described focus and short-viewport behavior as verified even though only prose/CSS plans existed.

Refactor:

- Layout guidance now forbids `hidden` for breakpoint-specific visibility and requires responsive CSS or mode-specific rendering.
- Evidence rules explicitly reject prose descriptions and plans as execution proof.

## Deterministic validation

The deterministic structure check `node engineering-react-interfaces/tests/validate-skill.mjs` passes after refactoring. This is structure evidence only; it does not satisfy the browser-dependent scenario gates. It verifies:

- Frontmatter starts on line 1 and includes compliant `name`, trigger-only `description`, and `version`.
- Description form, length, and third-person wording.
- Main file line budget and required searchable concepts.
- Every direct markdown reference exists.
- Long references include a contents section.
- All required references are one level deep from `SKILL.md`.
- Links use forward slashes.

## Remaining boundary

These evaluations test whether an AI applies the skill under representative pressure. They do not prove every future generated interface is correct. The skill therefore requires each actual host application to provide its own six-gate acceptance evidence.
