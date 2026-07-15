# Workflow

6 phases, each independently re-runnable via `--only <phase>`.

1. **resolve-input** — `resolve-input.mjs`. URL / file-key / find / selection → NodeId list + mode.
2. **extract** — `extract.mjs`. `figma-cli export-jsx <id>` per node; `figma-cli export css` once.
3. **transform** — `transform.mjs`. JSX → IR (JSON, schema-validated).
4. **render-react** — `render-react.mjs` + `bridges.mjs`. IR → `dist/<Name>/<Name>.jsx` + `.figma-bridges.json` + optional `tokens.css`.
5. **build-preview** — `build-preview.mjs`. esbuild compiles JSX to `dist-esm/`; emits `preview/index.html` + `preview/preview.js`.
6. **report** — orchestrator prints output list and server command.

Re-running a phase: `figma-to-react --url <url> --only render-react`.

`extract.mjs` is the only module that calls `figma-cli`. The rest are pure functions over JSON.
