# Known Limitations & Bridges

The skill targets "structure + style alignment", not pixel-perfect 1:1. These are the known cases that degrade:

| Case | What happens | Bridge kind |
|---|---|---|
| Vector paths with complex beziers | Rendered as `<img>` placeholder, no inline SVG auto-conversion | `flattened` |
| Figma `fontFamily` not available locally | Inline style emits `fontFamily` verbatim; rendering falls back to system font in browser | `font-missing` |
| Effects: drop shadow / inner shadow / blur | Best-effort: only `box-shadow` for drop shadow; inner shadow and blur dropped | `effect-lossy` |
| Blend modes (e.g. `MULTIPLY`) | Not emitted; element rendered normally | `effect-lossy` |
| Text without `lineHeight` | Wrap behavior may differ | `needs-rewrite` |

Every bridge is recorded in `dist/<Name>/<Name>.figma-bridges.json`. The file is consumed by humans or follow-up AI passes; the skill itself does not auto-fix bridges.
