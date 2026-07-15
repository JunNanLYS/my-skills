# React Render Mapping

`render-react.mjs` maps IR nodes to JSX with inline `style={{...}}`.

| IR type | Tag | Style properties |
|---|---|---|
| `frame` (layoutMode: horizontal) | `<div>` | `display: flex`, `flexDirection: row`, `gap`, `padding`, `justifyContent`, `alignItems` |
| `frame` (layoutMode: vertical) | `<div>` | `display: flex`, `flexDirection: column`, ... |
| `frame` (layoutMode: none) | `<div>` | `position: relative`; children get `position: absolute` + `left`/`top` |
| `rectangle` | `<div>` | `width`, `height`, `background`, `border` (from stroke), `borderRadius` |
| `ellipse` | `<div>` | `width`, `height`, `background`, `borderRadius: 50%` |
| `text` | `<span>` | `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `color` |
| `image` | `<img>` | `width`, `height`, `objectFit: contain`, `src` |
| `vector` | `<img data-figma-bridge="flattened">` | placeholder, real asset to be supplied by user |
| `group` | `<div>` | no visual style, only nesting |

Rules:
- Numeric CSS values get `'<n>px'` units. Never bare numbers in `style={{...}}`.
- `fill` → `background`; `stroke` + `strokeWidth` → `border: <w>px solid <color>`.
- Text `fill` → `color`.
- Auto-layout is always translated to flexbox; non-auto-layout uses absolute positioning for children.
