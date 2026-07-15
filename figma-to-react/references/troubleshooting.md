# Troubleshooting

## figma-cli not found

`extract.mjs` probes PATH first (`where figma-cli` on Windows, `which figma-cli` elsewhere), then tries these npm-global candidates:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\npm\figma-cli.cmd` |
| macOS / Linux | `~/.npm-global/bin/figma-cli` |
| npm config | `${npm_config_prefix}/node_modules/.bin/figma-cli` |
| Project-local | `./node_modules/.bin/figma-cli` |

If none of these contain a working `figma-cli`, `extract` aborts with a diagnostic listing every path it tried plus the fix-it command:

```
figma-to-react cannot locate figma-cli.

Tried:
  • where figma-cli (PATH)
  • ${npm_config_prefix}/node_modules/.bin/figma-cli
  • ${APPDATA}\npm\figma-cli.cmd
  • ~/.npm-global/bin/figma-cli
  • ./node_modules/.bin/figma-cli

Fix: install or link figma-cli globally, then verify with:
  figma-cli --version
```
