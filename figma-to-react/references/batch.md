# Batch Mode

When `--from-find` or repeated `--node` flags produce multiple NodeIds, the skill runs in batch mode:

- One `export-jsx` per NodeId.
- One shared `tokens.css` for the whole batch.
- One `dist/<Name>/` directory per component.
- One unified `preview/index.html` that mounts every component.

A `bridges` summary is printed per component at the end. **Note: in the current implementation, any error in `transformJsx` or `renderReactComponent` for one component will abort the entire batch — there is no per-component try/catch in the orchestrator loop. Bridges (degradation entries) are non-fatal; code errors are not.**
