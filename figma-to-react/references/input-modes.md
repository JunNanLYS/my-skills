# Input Modes (Daemon + PAT)

`resolve-input.mjs` picks one of two modes by probing `figma-cli`:

1. `daemon` — `figma-cli status` reports daemon running. Used for live work with the desktop app.
2. `pat` — daemon is down but `figma-cli config` has a token. Used for offline / CI use.

If neither is available, the skill aborts with a clear message pointing to `figma-cli connect` or `figma-cli config set-token <TOKEN>`.

Input forms:
- `--url <figma-url>` — URL must contain `node-id=...`. URL with only a file key is rejected.
- `--file-key <key> + --node <id>` — direct.
- `--from-find <name>` — calls `figma-cli find` and uses all matches (batch mode).
- `--selection` — daemon only; reads current Figma selection. Rejected under PAT.
