# Unified Preview Page

`build-preview.mjs` emits exactly one `preview/index.html` plus a `preview/preview.js` entry, plus per-component ESM bundles under `dist-esm/<Name>/<Name>.js`.

The HTML uses an import map for `react@18` and `react-dom@18/client` from `esm.sh`. The page renders one `<section data-component="...">` per component, each with a `<div id="mount-<Name>">` mount point.

Serving locally:
- `npx serve .`
- `python -m http.server 8000`

Per-component previews are forbidden by spec. A single `index.html` is the only allowed preview surface.
