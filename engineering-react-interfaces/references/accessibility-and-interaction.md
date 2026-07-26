# Accessibility and Interaction

Use this reference for controls, forms, navigation, dialogs, drawers, menus, tabs, data tables, drag/drop, keyboard behavior, or any interface that changes state.

## Contents

- Native-first rule
- Names, roles, states, and relationships
- Keyboard and focus
- Forms and validation
- Dialogs, drawers, menus, and popovers
- Dynamic content
- Pointer, touch, and drag
- Color, motion, zoom, and reflow
- Test workflow
- Common failures

## Native-first rule

Use the semantic element whose behavior matches the interaction:

- `button` for actions.
- `a` for navigation with a real destination.
- Form controls with associated labels.
- Headings in logical order.
- Lists for list content.
- Tables for tabular relationships.
- `dialog`, popover, `details`, and other platform primitives when project support and behavior fit.

Do not recreate native interaction with clickable `div`/`span`. ARIA does not add keyboard behavior, focus, activation, form submission, or disabled semantics automatically.

Use a proven accessible project component for complex composites when available. A component library is not a blanket guarantee; verify the composition.

## Names, roles, states, and relationships

Every interactive element must expose:

- Correct role, preferably native.
- Accessible name that identifies the action or field.
- Current state: expanded, selected, checked, pressed, invalid, busy, disabled where applicable.
- Relationships: label, description, error, controls, owner where applicable.

Rules:

- Visible text is usually the best accessible name.
- Icon-only controls need a specific name; avoid generic “menu” when “Open filters” is clearer.
- Do not duplicate visible text with redundant `aria-label` values that produce conflicting announcements.
- The HTML `title` attribute is supplementary only. It is not a reliable keyboard, touch, or screen-reader disclosure mechanism and does not satisfy a requirement to expose truncated essential text.
- Use `aria-describedby` for help/error text, not to replace labels.
- Mark decorative icons/images as hidden; meaningful media gets useful alternatives.
- Do not put unsupported roles/states on elements merely to satisfy an automated tool.

## Keyboard and focus

All functionality works without a pointer.

- Tab order follows the visual and logical reading order.
- Use natural DOM order; avoid positive `tabIndex`.
- Focus indicators are visible, sufficiently contrasted, and not clipped.
- Enter/Space behavior follows the control's native contract.
- Composite widgets follow established keyboard patterns rather than inventing shortcuts.
- Escape closes dismissible overlays when expected.
- Opening an overlay moves focus appropriately; closing restores focus to the invoking control when it still exists.
- Route/view changes place or announce focus deliberately when the context would otherwise be unclear.
- Disabled controls are not focus traps; explain unavailable actions when users need the reason.

Roving `tabIndex`, `aria-activedescendant`, focus traps, typeahead, and arrow-key navigation are easy to get wrong. Prefer project primitives or well-tested libraries for menus, listboxes, comboboxes, tabs, trees, grids, and dialogs.

## Forms and validation

- Every field has a persistent programmatic label.
- Required, optional, format, and constraints are communicated before failure where useful.
- Use the correct input type and `autocomplete` token.
- Validation does not depend only on color or placeholder text.
- Errors are associated with fields, stated specifically, and announced at an appropriate time.
- On failed submit, move focus to an error summary or first invalid field according to form complexity.
- Preserve entered values after recoverable errors.
- Prevent accidental duplicate submission and communicate pending/success state.
- Do not disable paste or password-manager behavior.

Placeholder is an example, not a label.

## Dialogs, drawers, menus, and popovers

For modal dialogs/drawers:

- The surface has an accessible name.
- Background content is inert/unavailable to interaction.
- Initial focus is deliberate and not automatically destructive.
- Focus remains within the modal while open.
- Escape and an explicit close control work.
- Focus returns on close.
- Content is usable at narrow and short viewports, including an on-screen keyboard.
- Scroll locking does not jump the page or prevent modal content from scrolling.

For menus/popovers:

- Use menu semantics only for application-style command menus; ordinary navigation lists usually remain links.
- Trigger exposes expanded state and relationship.
- Positioning handles viewport edges and zoom.
- Dismissal and focus return are predictable.
- Hover-only content is also available by focus and remains dismissible.

## Dynamic content

Use live regions sparingly.

- Loading state should not announce every visual skeleton.
- Announce meaningful status transitions: saved, failed, results updated when not otherwise obvious.
- Avoid placing large frequently changing trees inside live regions.
- Keep error/status messages in the DOM long enough to be announced.
- For async search, communicate result count/state without overwhelming each keystroke.
- Infinite scroll or virtualization must preserve orientation and focus; offer another navigation strategy when appropriate.

Loading, empty, error, and partial states remain semantically coherent. `aria-busy` can indicate a region update but does not replace visible feedback.

## Pointer, touch, and drag

- Controls have adequate activation area and spacing for the product's target devices.
- Hover is enhancement, not the only way to reveal essential actions or information.
- Do not require precision dragging for an essential task; provide keyboard/button alternatives.
- Pointer cancellation and accidental activation are considered for destructive actions.
- Tooltips do not contain essential interactive content.
- Touch gestures have visible controls or instructions.

## Color, motion, zoom, and reflow

- Text, controls, borders needed to identify controls, focus, and state meet the project's contrast target.
- Color is never the only status signal.
- Content and actions remain available at reduced motion.
- Avoid flashing and unsafe rapid animation.
- Browser zoom and text enlargement do not clip, overlap, or remove functionality.
- At narrow reflow, logical reading and focus order remain coherent.
- Do not block pinch zoom with the viewport meta tag.

## Test workflow

Automated accessibility checks catch only part of the problem. Run all applicable layers:

1. **Semantics inspection:** accessibility tree or DOM roles/names/states.
2. **Keyboard-only path:** Tab, Shift+Tab, Enter, Space, Escape, arrows where the pattern requires them.
3. **Focus inspection:** visible focus, opening/closing overlays, errors, route changes, removed elements.
4. **Automated scan:** project tool such as axe where available; resolve serious findings.
5. **Zoom/reflow:** narrow viewport plus browser zoom/text stress.
6. **Screen reader smoke test:** critical workflows when tools/environment permit; record if not run.
7. **Reduced motion/high contrast/theme:** when supported by the product.

Acceptance evidence names what was actually tested. Do not claim “screen-reader accessible” from ARIA code or an axe scan alone.

## Common failures

| Failure | Why it fails | Repair |
|---|---|---|
| Clickable `div` with role | Missing native behavior/state | Use `button` or `a` |
| Icon button has tooltip only | Tooltip may not name control reliably | Add accessible name; tooltip is supplementary |
| Modal only looks modal | Focus/background remain active | Use native/proven dialog behavior and verify |
| Positive `tabIndex` | Brittle order diverges from DOM | Fix DOM order; use 0/-1 only where appropriate |
| Error shown by red border | No message/relationship | Specific text + `aria-describedby`/invalid state |
| `aria-live` around whole page | Excessive repeated announcements | Small dedicated status region |
| Hover reveals actions | Keyboard/touch cannot find them | Show on focus and provide persistent accessible path |
| Clipped outline | Keyboard user loses location | Repair overflow/outline strategy; use visible focus ring |
| Disabled button with no explanation | User cannot discover why | Keep explanation visible or use discoverable non-submittable state |
| Hover/title reveals full text | Touch, keyboard, and screen-reader access is inconsistent | Wrap essential text or provide a persistent/focusable detail path |
| Library primitive assumed safe | Integration can break labels/focus | Test names, roles, states, keyboard, focus |
