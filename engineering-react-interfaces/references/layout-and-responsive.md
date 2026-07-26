# Layout and Responsive Engineering

Use this reference for grids, flex layouts, app shells, dashboards, cards, tables, fixed/sticky regions, dynamic content, and any clipping, overlap, misalignment, or overflow risk.

## Contents

- Geometry model
- Required CSS invariants
- Responsive composition
- Viewport and safe-area handling
- Fixed and sticky UI
- Text and internationalization stress
- Media, tables, charts, and embeds
- Scroll ownership
- State geometry
- Browser inspection
- Common failure patterns

## Geometry model

For each major region, define this contract before styling:

| Property | Questions |
|---|---|
| Parent | Which formatting context owns it: normal flow, flex, grid, positioned, dialog/top layer? |
| Width | Fluid, bounded, intrinsic, fixed, or content-sized? What is min/max? |
| Height | Content-driven, viewport-bound, aspect-ratio, or scroll container? |
| Shrink/grow | What yields first when space disappears? |
| Overflow | Wrap, reflow, local scroll, clip intentionally, or disclose? |
| Position | In flow, sticky, fixed, absolute? What reserves its space? |
| Content extremes | Empty, maximum text, unbroken text, large numbers, missing/odd media? |
| Breakpoints | At which observed failure does the composition change? |

The browser must be able to solve the layout without relying on lucky content lengths.

## Required CSS invariants

Start with these defaults, then deviate deliberately:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

img,
svg,
video,
canvas {
  display: block;
  max-inline-size: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
}

.flex-child,
.grid-child {
  min-inline-size: 0;
}

.long-token {
  overflow-wrap: anywhere;
}
```

Important constraints:

- `min-width: 0` / `min-inline-size: 0` is often required on flex and grid children that contain truncating or wrapping content.
- In grid, use `minmax(0, 1fr)` when tracks must be allowed below min-content size.
- Use `max-width: 100%` for intrinsic media, but also reserve dimensions with `width`/`height` or `aspect-ratio`.
- Prefer `min-height: 0` on nested flex/grid scroll regions so they can shrink and scroll rather than overflow their parent.
- `position: absolute` removes content from flow. Use it for overlays/decorations, not ordinary responsive placement.
- The HTML `hidden` attribute removes an element in every viewport. Do not use it for breakpoint-specific visibility; use responsive CSS or conditionally render for the intended mode, while preserving semantics and focus.
- Avoid fixed block heights for containers with unknown text. Use min/max constraints and content flow.

Do not apply `overflow-x: hidden` to `html`, `body`, or the app root as a first-line fix. It conceals the failing descendant and may clip focus indicators or positioned UI.

## Responsive composition

Build from content pressure:

1. Implement the narrowest coherent composition.
2. Let regions grow fluidly within explicit min/max constraints.
3. Resize continuously, not only at named devices.
4. Add a breakpoint where hierarchy or usability actually fails.
5. Test immediately below and above that breakpoint.

When space disappears, choose the right transformation:

- **Reflow:** columns become rows.
- **Reorder:** supporting information moves after the main task.
- **Collapse/disclose:** secondary controls move into an accessible menu, drawer, or details region.
- **Replace navigation:** sidebar becomes a drawer, bottom navigation, or compact top navigation.
- **Local scroll:** tables, code, timelines, or chips scroll within a labeled region.
- **Simplify:** reduce non-essential decoration or secondary metrics.

Do not only reduce font size, padding, and gaps. Shrinking a desktop composition is not a mobile design.

Useful fluid primitives:

```css
.page {
  inline-size: min(100% - 2 * var(--page-gutter), var(--content-max));
  margin-inline: auto;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}

.title {
  font-size: clamp(1.75rem, 1.2rem + 2vw, 3.5rem);
}
```

Use container queries when a component responds to its allocated region rather than the global viewport.

## Viewport and safe-area handling

Use progressive enhancement in the correct cascade order:

```css
.app-shell {
  min-block-size: 100vh;
  min-block-size: 100dvh;
}
```

The supported modern value comes after the fallback so it wins. Choose among:

- `dvh`: tracks dynamic browser chrome; common for app shells.
- `svh`: stable small viewport; useful when content must never hide behind expanded chrome.
- `lvh`: largest viewport; rarely the safest default.

Account for safe areas where edge-fixed UI exists:

```css
.composer {
  padding-block-end: max(0.75rem, env(safe-area-inset-bottom));
}
```

Test both short and tall viewports. Width-only testing misses keyboards, address bars, landscape phones, and small laptop windows.

## Fixed and sticky UI

Prefer normal flow and sticky positioning before fixed positioning.

For every fixed/sticky element:

- Identify the scroll container it belongs to.
- Reserve or pad content so nothing important is obscured.
- Define stacking order as a small layer system, not random large `z-index` values.
- Check focus visibility beneath headers, banners, drawers, and composers.
- Verify open overlays at narrow and short viewports.
- Handle safe-area insets.
- Test content growth and browser zoom.

`position: sticky` silently fails when an ancestor's overflow or containment creates the wrong scrolling context. Inspect the rendered ancestor chain.

## Text and internationalization stress

Test all of the following:

- Empty string and missing optional label.
- Typical copy.
- 2–3× expansion for translation.
- Long unbroken URL, identifier, email, hash, or filename.
- Large and negative numbers, currency variation, and localized dates.
- Mixed scripts and fallback fonts.
- Multiline button or label where translation requires it.

Choose content behavior deliberately:

| Content | Default behavior |
|---|---|
| Essential heading/body | Wrap; do not truncate silently |
| Secondary card metadata | Bounded wrap or intentional ellipsis with accessible full value |
| URL/identifier in prose | `overflow-wrap: anywhere` |
| Code | Local horizontal scroll, preserve whitespace |
| User-authored prose | Preserve intended line breaks; break pathological tokens |
| Tabular numeric value | Prevent destructive wrap when space can be reassigned |

Line clamp is a product decision, not a universal resilience technique. If hidden text affects choice or action, provide an accessible reveal/title/detail path.

## Media, tables, charts, and embeds

### Media

- Reserve space with intrinsic dimensions or `aspect-ratio` to reduce CLS.
- Define `object-fit` and focal-point behavior.
- Handle missing, broken, slow, portrait, landscape, tiny, and huge assets.
- Use responsive image sources and meaningful `sizes` when the image service supports them.
- Do not upscale poor-quality assets and call the result polished.

### Tables

- Preserve table semantics for genuinely tabular data.
- Provide a labeled local scroll container when columns cannot reflow.
- Keep essential row actions discoverable.
- Consider a deliberate card/list transformation only when it preserves comparison and labels.
- Test sticky headers/columns against overflow ancestors and focus.

### Charts

- Give the chart a bounded responsive container.
- Verify labels, legends, tooltips, empty/error states, and large/negative values.
- Provide an accessible text/table equivalent for essential data.
- Avoid importing a large chart library for a trivial visualization without bundle evidence.

### Embeds and code

Constrain embeds to the available inline size and a deliberate aspect ratio. Code blocks own local horizontal scrolling; the page does not.

## Scroll ownership

Each axis should have a clear owner. Document nested scrolling when it is intentional.

For application shells:

- The shell can be viewport-bound.
- Headers/composers do not shrink.
- The content region gets `min-height: 0` and owns vertical scrolling.
- Lists and details may own independent scrolling only when simultaneous context is necessary.
- Mobile overlays lock background scroll correctly and restore it on close.

Do not use `contain: strict` casually. It implies size, layout, style, and paint containment and can produce zero-size or positioning surprises unless dimensions are explicitly established. Prefer the narrowest containment (`paint`, `layout`, or `content-visibility`) supported by measurement.

## State geometry

Render and inspect:

- Initial loading and progressive loading.
- Empty results.
- Recoverable and terminal errors.
- Partial data and missing optional fields.
- Maximum data density.
- Open menus, popovers, dialogs, tooltips, toasts, banners, and validation messages.
- Selected/expanded rows and cards.
- Permission-denied or read-only modes.

Skeletons should reserve the same approximate geometry as loaded content. If the skeleton shape differs dramatically, loading completion causes layout shift.

## Browser inspection

At minimum, inspect the running interface at:

- 320 × 568 or the product's supported minimum.
- 375 × 812.
- 768 × 1024.
- A compact laptop viewport around 1280 × 720.
- The primary reference width.
- An ultrawide width around 1920–2560.
- Immediately below and above each composition breakpoint.

At every size:

1. Inspect the accessibility tree or DOM structure.
2. Compare viewport and document scroll dimensions.
3. Inspect suspicious elements' computed size, overflow, position, and bounding box.
4. Exercise controls and dynamic states.
5. Capture a screenshot for visual review where tools permit.
6. Fix the source of any overlap, clipping, offscreen interaction, or accidental page scroll.

A useful programmatic horizontal-overflow probe in a browser console:

```js
[...document.querySelectorAll('*')]
  .filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left < -0.5 || rect.right > document.documentElement.clientWidth + 0.5;
  })
  .map((element) => ({
    element,
    rect: element.getBoundingClientRect(),
  }));
```

Review every result; intentional off-canvas drawers and animation states need context.

## Common failure patterns

| Symptom | Likely cause | Repair |
|---|---|---|
| Ellipsis does not engage in flex row | Child min-content width cannot shrink | Add `min-inline-size: 0` to the correct flex/grid child |
| Page scrolls horizontally | Fixed width, transform, min-content track, negative margin, or viewport unit mismatch | Locate the overflowing element; repair its constraint |
| Last content hidden by composer | Fixed control does not reserve space | Keep composer in layout or add measured padding/safe area |
| `100dvh` seems ignored | Fallback declared after modern value | Put `100vh` first, `100dvh` second |
| Sticky header does not stick | Wrong overflow/scroll ancestor | Choose the intended scroll owner and adjust ancestor overflow |
| Cards collapse too narrow | Forced column count conflicts with min card width | Use intrinsic `minmax(min(100%, desired), 1fr)` or reduce columns |
| Content is “fixed” by clipping | `overflow: hidden` hides the symptom | Remove clipping, identify geometry source, then re-evaluate intent |
| Layout shifts after load | Media/state geometry not reserved | Add dimensions/aspect ratio and state-matched skeletons |
| Mobile loses navigation/action | Desktop region hidden with no replacement | Introduce a mobile composition and accessible disclosure |
| Mobile pane disappears on desktop after selection | HTML `hidden` used for breakpoint-specific state | Use mode-specific CSS/conditional rendering; `hidden` is global |
| Overlay works visually but focus escapes | Visual layer lacks dialog/focus behavior | Use native/popover/dialog primitives or proven accessible component |
