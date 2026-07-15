# Batch Mode

When `--from-find` or repeated `--node` flags produce multiple NodeIds, the skill runs in batch mode:

- One `export-jsx` per NodeId.
- One shared `tokens.css` for the whole batch.
- One `dist/<Name>/` directory per component.
- One unified `preview/index.html` that mounts every component.

A `bridges` summary is printed per component at the end. The orchestrator never aborts the batch on a single component failure unless the failure is a hard error (e.g. `extract` failed); bridges (degradation) entries are non-fatal.
