# Visual Direction and Interface Aesthetics

Use this reference for new pages, redesigns, screenshot or Figma implementation, visual polish, and any task where the result must feel deliberate rather than generic.

## Contents

- Design brief extraction
- Visual system contract
- Composition and hierarchy
- Typography
- Color and surfaces
- Density and spacing
- Motion
- Copy and states
- Anti-template critique
- Visual acceptance

## Design brief extraction

Before writing JSX or CSS, record a compact brief:

```markdown
Subject: [concrete product/domain]
Audience: [primary user and context]
Single job: [the one thing this surface must make easier]
Content priority: [primary / secondary / supporting]
Brand traits: [three specific adjectives]
Constraints: [existing system, assets, accessibility, platform]
Reference facts: [observed, not guessed]
Open assumptions: [choices made because the brief is silent]
```

If the brief is under-specified, choose a defensible direction and state it. Do not silently fall back to a generic software-as-a-service dashboard.

When implementing a reference image or design file, separate:

- **Observed facts:** dimensions, hierarchy, alignment, color relationships, type roles, density, assets, repeated patterns.
- **Responsive hypotheses:** what should reflow, collapse, scroll locally, reorder, or become an overlay.
- **Unknowns:** hover/focus/pressed states, mobile navigation, text extremes, error states, motion, data behavior.

Never treat a single static viewport as a complete responsive specification.

## Visual system contract

Define a small token set before styling component details. Reuse project tokens when they exist.

```css
:root {
  --color-canvas: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-muted: ...;
  --color-accent: ...;
  --color-border: ...;

  --font-display: ...;
  --font-body: ...;
  --font-utility: ...;

  --space-1: ...;
  --space-2: ...;
  --space-3: ...;
  --space-4: ...;

  --radius-control: ...;
  --radius-surface: ...;
  --shadow-raised: ...;
  --motion-fast: ...;
  --motion-standard: ...;
}
```

The values must express the brief. Do not add a display font, gradient, glass effect, glow, giant radius, or heavy shadow without a domain-specific reason.

## Composition and hierarchy

A visual hierarchy should be explainable in content terms:

1. What must be noticed first?
2. What action or reading path follows?
3. What information is supporting evidence?
4. What can be disclosed later?

Use size, position, contrast, whitespace, grouping, and type role to answer those questions. Avoid making every surface a card; grouping by proximity or dividers is often clearer and lighter.

Choose one signature element that belongs to the subject: a meaningful data representation, material treatment, editorial composition, interaction, illustration, or typographic gesture. Spend visual boldness there and keep the rest disciplined.

Structural devices must carry information. Numbering is for actual sequence or rank. Eyebrows classify content. Dividers separate real groups. Decorative badges must not simulate meaning.

## Typography

Typography establishes personality and usable hierarchy.

- Define distinct roles: display, heading, body, label, utility/data, caption.
- Use a restrained scale with consistent line heights and weights.
- Keep body text readable; prose usually benefits from a bounded measure around 45–75 characters.
- Use tabular numerals where values must align or update.
- Test fallback fonts. Never reference an unloaded font and assume it exists on the operating system.
- Avoid microscopic labels, low-contrast all-caps, excessive letter spacing, and weight-only hierarchy.
- Test text at browser zoom and with translated/expanded copy.

A distinctive typeface does not rescue a weak hierarchy. A system font can be excellent when composition and detail are precise.

## Color and surfaces

- Name colors by role, not hue. Components consume semantic tokens.
- Ensure text, controls, focus indicators, and state distinctions meet the project's contrast requirements.
- Do not encode status by color alone; pair it with text, iconography, pattern, or position.
- Use borders and shadows to explain elevation or containment, not to decorate every object.
- Limit accent color to actions, selection, emphasis, or domain-significant data.
- Verify light/dark themes independently if both are supported. Inverting a palette is not a dark-mode design.

Avoid the common AI defaults unless the brief genuinely calls for them: universal indigo accents, cream-and-terracotta editorial styling, black-and-acid palettes, excessive gradients, floating glass cards, or a grid of identical rounded rectangles.

## Density and spacing

Density follows the task:

- Frequent expert workflows favor compact, scannable controls and stable alignment.
- Marketing or exploratory surfaces can use larger rhythm and fewer simultaneous decisions.
- Touch targets still need sufficient activation area even in dense interfaces.

Choose a spacing scale and use it semantically: inline gaps, control padding, group gaps, section gaps, page margins. Random one-off values create subtle misalignment.

Check optical alignment, not only mathematical alignment. Icons and mixed font sizes may need controlled optical adjustment, but avoid arbitrary offsets that fail at other sizes.

## Motion

Motion must explain change, orientation, hierarchy, or feedback.

- Prefer one orchestrated moment plus small interaction feedback over animation everywhere.
- Use `transform` and `opacity` for most transitions.
- Keep ordinary micro-interactions fast; long duration is reserved for intentional narrative moments.
- Do not animate hundreds of list items individually.
- Do not add perpetual motion, bounce, parallax, or cursor-following effects by default.
- Support `prefers-reduced-motion: reduce`; all content and actions remain available without animation.
- Prevent entrance animations from delaying interaction or creating layout shift.

## Copy and states

Words are interface material.

- Use the user's vocabulary, not implementation terms.
- Controls name the result: “Save changes,” “Invite member,” “Retry.”
- Keep action names consistent through button, dialog, progress, toast, and result.
- Errors explain what happened and what can be done next.
- Empty states direct a relevant next action; they are not decorative slogans.
- Use realistic domain content while designing. Lorem ipsum and repeated round numbers conceal layout problems.

Every state belongs to the same design system: loading, empty, error, partial, success, disabled, selected, hover, focus, pressed, drag, and permission-denied where applicable.

## Anti-template critique

Before implementation and again after the first rendered pass, answer:

- Could this palette and type treatment be reused unchanged for an unrelated product?
- Are cards, pills, gradients, and icons carrying meaning or filling space?
- Is the hierarchy obvious without reading every label?
- Is there exactly one memorable element, or many competing effects?
- Does the real content shape the composition?
- Does the interface look intentional at narrow, middle, and wide sizes?
- What single decorative element can be removed without reducing understanding?

If the design could plausibly be generated for any brief, revise at least one foundational choice: composition, typography, content structure, palette, or signature. Do not merely add more decoration.

## Visual acceptance

Inspect the real rendered interface, preferably with screenshots for comparison.

Minimum visual pass:

1. Compare hierarchy and composition with the brief/reference.
2. Inspect alignment, spacing rhythm, typography, color, border, shadow, and icon consistency.
3. Inspect all user-visible states, not only the ideal loaded state.
4. Inspect hover, focus, pressed, selected, disabled, and reduced-motion behavior.
5. Repeat at narrow, middle, wide, and breakpoint-adjacent widths.
6. Remove accidental decoration and repair generic-looking decisions.

A visual review is incomplete when based only on source code or a single screenshot.
