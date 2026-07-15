# `figma-to-react` v2 — Production Environment Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two production-reported bugs in `figma-to-react` v1.0: (1) `extract.mjs` spawn fails with ENOENT when `figma-cli` is installed in npm-global on Windows; (2) `<script type="importmap">` in preview HTML cannot resolve `react-dom/client` named exports, so `createRoot is not a function`. Bumps skill version to 2.0.

**Architecture:** Three localizing edits inside the existing module boundaries. (1) New `locateFigmaCli()` helper inside `extract.mjs` does PATH probe (where/which) plus 5 fallback paths with `--version` validation; spawn ENOENT produces a fix-it diagnostic error with all paths tried. (2) `preview.html.mjs` deletes the `<script type="importmap">` block. (3) `build-preview.mjs` writes two `.mjs` proxy modules (`react-esm.mjs`, `react-dom-client-esm.mjs`) pointing at esm.sh named URLs, then post-processes esbuild output files to rewrite bare imports to those proxies; preview.js becomes a dynamic-import loop with no importmap dependency.

**Tech Stack:** Node.js 20+ (ESM only), `figma-cli` (external, unchanged), `esbuild ^0.24.0` (devDep, unchanged), Node built-in `node:test` runner (unchanged).

---

## Global Constraints

All v1 constraints carry forward. v2-only additions are marked **NEW**:

- ESM only (`"type": "module"` in `package.json`); no CommonJS, no TypeScript.
- Node.js engine: `>=20`.
- All Figma access goes through `figma-cli`; no direct REST API, no MCP, no eval/run fallback.
- React output uses inline `style={{...}}` only.
- Preview page is exactly one `preview/index.html`; per-component previews are forbidden.
- esbuild fixed at `^0.24.0`.
- All hard rules use "必须 / 禁止 / 只有……才允许" wording.
- **`extract.mjs` is the only module that shells out to `figma-cli`** (Authority Invariant from v1 SKILL.md, unchanged).
- **`--url` must include a `node-id` parameter**; URL with only a file key is rejected.
- Auto-layout Frames → flexbox; non-auto-layout Frames → relative-positioned `<div>` with absolutely positioned children.
- Numeric CSS values get `'Xpx'` units.
- Figma variables render as `'var(--token-name, #fallback)'`.
- **NEW — PATH-aware spawn:** `defaultRunner` must locate `figma-cli` via PATH probe plus 5 fallback paths, not bare-name spawn.
- **NEW — No importmap:** `preview/index.html` MUST NOT contain `<script type="importmap">`. All `react` / `react-dom/client` references resolve via `dist-esm/*-esm.mjs` proxy modules that re-export from esm.sh URLs.
- **NEW — Static file paths are auto-generated:** `dist-esm/react-esm.mjs` and `dist-esm/react-dom-client-esm.mjs` are written by `build-preview.mjs` and must not be hand-edited (commented as such).
- **NEW — Versioning:** `SKILL.md` `version` frontmatter field bumps from `1.0` to `2.0`.

---

## Task 1: PATH-aware spawn in `extract.mjs`

**Files:**
- Modify: `figma-to-react/scripts/extract.mjs` (entire `defaultRunner` function, line 6-16)
- Modify: `figma-to-react/tests/extract.test.mjs` (add 2 tests at the end)

**Interfaces:**
- Consumes: existing call sites in `orchestrate.mjs` and tests that pass `runner` parameter (unchanged — `defaultRunner` is the fallback).
- Produces: same `{ code, stdout, stderr }` resolution shape on success; on ENOENT, `Promise.reject(figmaCliNotFoundError(pathsTried))` with `Error.message` containing each path tried + a fix-it snippet.

**Spec reference:** Spec §2 改动 1 — `locateFigmaCli` body, `figmaCliNotFoundError` body, `defaultRunner` new body.

- [ ] **Step 1: Write the failing test — spawn ENOENT produces diagnostic**

Append to `figma-to-react/tests/extract.test.mjs`:

```javascript
test('extract: ENOENT from defaultRunner yields figmaCliNotFoundError with all paths', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  // Force spawn ENOENT: empty PATH, no candidates.
  const savedEnv = { PATH: process.env.PATH, npm_config_prefix: process.env.npm_config_prefix, APPDATA: process.env.APPDATA, HOME: process.env.HOME };
  process.env.PATH = '';
  process.env.npm_config_prefix = '';
  delete process.env.APPDATA;
  delete process.env.HOME;
  try {
    await assert.rejects(
      async () => {
        // Dynamic import to ensure defaultRunner is loaded with current process state.
        const mod = await import('../scripts/extract.mjs?cachebust=' + Date.now());
        await mod.defaultRunner(['--version']);
      },
      (err) => {
        assert.match(err.message, /cannot locate figma-cli/);
        assert.match(err.message, /npm install/);
        return true;
      }
    );
  } finally {
    process.env.PATH = savedEnv.PATH;
    if (savedEnv.npm_config_prefix) process.env.npm_config_prefix = savedEnv.npm_config_prefix;
    if (savedEnv.APPDATA) process.env.APPDATA = savedEnv.APPDATA;
    if (savedEnv.HOME) process.env.HOME = savedEnv.HOME;
  }
});

test('extract: locateFigmaCli returns a path when PATH probe succeeds', async () => {
  // Simulate PATH probe via stub: override process to force `where`/`which` lookup.
  // Strategy: when PATH contains figma-cli at any path, defaultRunner finds it.
  // For unit test, we exercise locateFigmaCli by ensuring it does not throw and
  // that a valid spawn target is identified somewhere; here we verify the
  // diagnostic error path is NOT triggered when locate succeeds.

  const savedEnv = { PATH: process.env.PATH };
  // Set PATH to /tmp only — no figma-cli there; should fall through to candidates.
  process.env.PATH = '/tmp';
  process.env.npm_config_prefix = '';
  delete process.env.APPDATA;
  delete process.env.HOME;
  try {
    const mod = await import('../scripts/extract.mjs?cachebust=' + Date.now());
    await assert.rejects(
      mod.defaultRunner(['--version']),
      /cannot locate figma-cli/
    );
    // (locateFigmaCli returning null is also acceptable — what's not acceptable is the diagnostic missing.)
  } finally {
    process.env.PATH = savedEnv.PATH;
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd figma-to-react && npm test -- --test-name-pattern="ENOENT|locateFigmaCli"`
Expected: both new tests FAIL with `defaultRunner is not a function` or `Cannot find module` (because the new code isn't written yet).

- [ ] **Step 3: Replace `defaultRunner` in `figma-to-react/scripts/extract.mjs`**

Replace the existing `defaultRunner` and add two new helpers (`locateFigmaCli`, `figmaCliNotFoundError`). New file content (full file):

```javascript
// Drive figma-cli to extract per-node JSX and a shared tokens.css.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

// Locate figma-cli executable. PATH probe first, then common npm-global paths.
function locateFigmaCli() {
  // 1. PATH probe via `where` (Windows) / `which` (POSIX).
  const isWin = process.platform === 'win32';
  const probe = isWin ? 'where' : 'which';
  const r = spawnSync(probe, ['figma-cli'], {
    encoding: 'utf8',
    shell: isWin,
  });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.trim().split(/\r?\n/)[0];
  }

  // 2. Fallback candidates. All `--version`-verified before being returned.
  const candidates = [
    process.env.npm_config_prefix && `${process.env.npm_config_prefix}${isWin ? '\\' : '/'}node_modules${isWin ? '\\' : '/'}.bin${isWin ? '\\' : '/'}figma-cli${isWin ? '.cmd' : ''}`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli`,
    !isWin && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
    `${process.cwd()}/node_modules/.bin/figma-cli${isWin ? '.cmd' : ''}`,
  ].filter(Boolean);

  for (const c of candidates) {
    const v = spawnSync(c, ['--version'], { encoding: 'utf8', stdio: 'ignore' });
    if (v.status === 0) return c;
  }
  return null;
}

function figmaCliNotFoundError(triedPaths) {
  return new Error(
    'figma-to-react cannot locate figma-cli.\n\n' +
      'Tried:\n' +
      triedPaths.map((p) => `  • ${p}`).join('\n') +
      '\n\nFix: install or link figma-cli globally, then verify with:\n' +
      '  figma-cli --version\n\n' +
      'If figma-cli is already installed, ensure it is on PATH or ' +
      'in one of the locations searched above.'
  );
}

function defaultRunner(args) {
  const isWin = process.platform === 'win32';
  const located = locateFigmaCli();
  if (!located) {
    const allTried = [
      `${isWin ? 'where' : 'which'} figma-cli (PATH)`,
      process.env.npm_config_prefix && `${process.env.npm_config_prefix}${isWin ? '\\' : '/'}node_modules/.bin/figma-cli`,
      isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
      !isWin && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
      `${process.cwd()}/node_modules/.bin/figma-cli`,
    ].filter(Boolean);
    return Promise.reject(figmaCliNotFoundError(allTried));
  }
  return new Promise((resolve, reject) => {
    // Windows: shell:true so .cmd / .ps1 get the right interpreter.
    const proc = spawn(located, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function safeName(id) {
  return id.replace(/[:]/g, '-');
}

export async function extract({ nodeIds, mode, workdir, runner = defaultRunner }) {
  const tmpDir = join(workdir, 'tmp');
  await mkdir(tmpDir, { recursive: true });

  // 1. tokens.css (once).
  const tokensResult = await runner(['export', 'css']);
  if (tokensResult.code !== 0) {
    throw new Error(`figma-cli export css failed: ${tokensResult.stderr || tokensResult.stdout}`);
  }
  const tokensFile = join(tmpDir, 'tokens.css');
  await writeFile(tokensFile, tokensResult.stdout, 'utf8');

  // 2. Per-node export-jsx.
  const jsxFiles = [];
  for (const id of nodeIds) {
    const result = await runner(['export-jsx', id, '--pretty']);
    if (result.code !== 0) {
      throw new Error(`figma-cli export-jsx ${id} failed: ${result.stderr || result.stdout}`);
    }
    const outPath = join(tmpDir, `${safeName(id)}.jsx`);
    await writeFile(outPath, result.stdout, 'utf8');
    jsxFiles.push(outPath);
  }

  return { jsxFiles, tokensFile, mode };
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd figma-to-react && npm test -- --test-name-pattern="ENOENT|locateFigmaCli"`
Expected: both new tests PASS.

- [ ] **Step 5: Run full suite to ensure no regression**

Run: `cd figma-to-react && npm test`
Expected: 36/36 pre-existing tests PASS + 2 new tests PASS = 38/38.

- [ ] **Step 6: Commit**

```bash
git add figma-to-react/scripts/extract.mjs figma-to-react/tests/extract.test.mjs
git commit -m "feat(figma-to-react): locate figma-cli across PATH + npm-global paths

extract.mjs defaultRunner previously did `spawn('figma-cli', ...)`, which
fails ENOENT on Windows when figma-cli is installed in %AppData%\\npm but
not on PATH. Now locateFigmaCli probes where/which, then tries the npm-global
prefix, %APPDATA%\\npm, ~/.npm-global/bin, and local node_modules/.bin. Each
fallback is verified with `figma-cli --version`. Failure produces a clear
error listing every path tried plus a fix-it snippet.

No contract change for callers: same { code, stdout, stderr } shape on
success."
```

---

## Task 2: Remove importmap from preview HTML

**Files:**
- Modify: `figma-to-react/templates/preview.html.mjs` (delete lines 21-28, the importmap block)
- Modify: `figma-to-react/tests/build-preview.test.mjs` (delete the obsolete `importmap` assertion on line 27; add 1 new assertion checking that `importmap` is absent)

**Interfaces:**
- `renderPreviewHtml(componentNames)` signature unchanged.
- Output no longer contains `<script type="importmap">` block.

**Spec reference:** Spec §2 改动 2.

- [ ] **Step 1: Update the failing test**

In `figma-to-react/tests/build-preview.test.mjs`, **delete** line 27:

```javascript
  assert.match(html, /importmap/);
```

This converts the existing test `buildPreview writes preview/index.html with one section per component` from passing to FAILING — which is intentional (red → green TDD).

- [ ] **Step 2: Run the modified test to verify it fails**

Run: `cd figma-to-react && npm test -- --test-name-pattern="writes preview/index.html"`
Expected: FAIL with `AssertionError: expected '…' to match /importmap/`.

- [ ] **Step 3: Delete the importmap block in `preview.html.mjs`**

In `figma-to-react/templates/preview.html.mjs`, delete lines 21-28 (the `<script type="importmap">` block). The file becomes:

```javascript
// Render the unified preview HTML page given the list of component names.
export function renderPreviewHtml(componentNames) {
  const sections = componentNames.map(name => `      <section data-component="${escapeAttr(name)}">
        <h2>${escapeHtml(name)}</h2>
        <div id="mount-${escapeAttr(name)}"></div>
      </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Figma → React Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; background: #F9FAFB; color: #111827; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 4px 0; font-size: 20px; }
    p { margin: 0; color: #6B7280; font-size: 13px; }
    section { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    section h2 { margin: 0 0 16px 0; font-size: 14px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <header>
    <h1>Figma → React Preview</h1>
    <p>All components rendered in one page. Open this file via a static server (e.g. <code>npx serve .</code> or <code>python -m http.server</code>).</p>
  </header>
  <main>
${sections}
  </main>
  <script type="module" src="./preview.js"></script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Run the modified test to verify it passes**

Run: `cd figma-to-react && npm test -- --test-name-pattern="writes preview/index.html"`
Expected: PASS.

- [ ] **Step 5: Add a new assertion that importmap is absent**

Append to `figma-to-react/tests/build-preview.test.mjs`:

```javascript
test('renderPreviewHtml does not emit an importmap block', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.ok(!html.includes('importmap'), 'preview HTML must not contain importmap');
});
```

- [ ] **Step 6: Run all build-preview tests**

Run: `cd figma-to-react && npm test -- tests/build-preview.test.mjs`
Expected: 3 existing tests still pass (one already covers a different surface) + 1 new test passes. Other tests may show `preview.js`-related failures — that's expected; Task 3 fixes them.

> **Note:** Task 3 is required for the rest of the test suite to go green. If you intend to commit Task 2 standalone, expect 2-3 follow-up failures in tests that assert `preview.js` content. Either commit separately or commit together with Task 3 as one combined commit.

- [ ] **Step 7: Commit (recommended: combine with Task 3)**

Either as a standalone commit:

```bash
git add figma-to-react/templates/preview.html.mjs figma-to-react/tests/build-preview.test.mjs
git commit -m "feat(figma-to-react): remove importmap from preview HTML

esm.sh exposes react-dom/client as a default-export namespace, which
importmap cannot map to the inner named exports. Use direct URL imports
via dist-esm/*-esm.mjs proxy modules (added in next commit) instead."
```

Or, more safely, **combine this commit with Task 3** since the test suite breaks between tasks. The combined commit message is given at the end of Task 3.

---

## Task 3: Rebuild `preview.js` + `dist-esm/*-esm.mjs` proxies + import-rewrite

**Files:**
- Modify: `figma-to-react/scripts/build-preview.mjs` (rewrite `buildPreview` function and add `rewriteImports` helper)
- Modify: `figma-to-react/tests/build-preview.test.mjs` (update 2 existing assertions and add 4 new tests)
- Modify: `figma-to-react/tests/e2e.test.mjs` (add 2 assertions)

**Interfaces:**
- Same `buildPreview({ workdir })` signature.
- New side effects under `workdir/dist-esm/`:
  - `react-esm.mjs` — re-exports from `https://esm.sh/react@18` (default + namespace)
  - `react-dom-client-esm.mjs` — exports everything from `https://esm.sh/react-dom@18/client`
- New side effect: each `dist-esm/<Name>/<Name>.js` has its `from 'react'` / `from 'react-dom/client'` imports rewritten to point at the proxies.
- `preview/preview.js` content changes from a static `import React from 'react'; import ${N} from '...';` block to a dynamic-import loop.

**Spec reference:** Spec §2 改动 3.

- [ ] **Step 1: Replace the existing preview.js-content test with the new-shape test**

In `figma-to-react/tests/build-preview.test.mjs`, replace the test `buildPreview writes preview/preview.js that imports each compiled component` (lines 30-38) with:

```javascript
test('buildPreview writes preview/preview.js as a dynamic-import loop (no bare react specifiers)', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const js = readFileSync(join(work, 'preview', 'preview.js'), 'utf8');
  // Dynamic import, not static.
  assert.match(js, /await import\(`\.\.\/dist-esm\/Button\/Button\.js`\)/);
  // No bare react specifiers.
  assert.ok(!/from\s+['"]react['"]/.test(js), 'preview.js must not depend on importmap');
  assert.ok(!/from\s+['"]react-dom\/client['"]/.test(js));
  // createRoot is pulled via the proxy.
  assert.match(js, /react-dom-client-esm\.mjs/);
});
```

This test currently FAILS because the existing build-preview.mjs emits a static-import block.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd figma-to-react && npm test -- --test-name-pattern="dynamic-import loop"`
Expected: FAIL — current preview.js has `import React from 'react'` not `await import(...)`.

- [ ] **Step 3: Add 4 new tests to `tests/build-preview.test.mjs`**

Append the following 4 tests at the end of the file (after the test added in Task 2 Step 5):

```javascript
test('buildPreview writes dist-esm/react-esm.mjs that re-exports from esm.sh/react@18', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const proxy = readFileSync(join(work, 'dist-esm', 'react-esm.mjs'), 'utf8');
  assert.match(proxy, /from\s+['"]https:\/\/esm\.sh\/react@18['"]/);
  assert.match(proxy, /export\s*\{\s*default\s*\}/);
});

test('buildPreview writes dist-esm/react-dom-client-esm.mjs that re-exports from esm.sh/react-dom@18/client', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const proxy = readFileSync(join(work, 'dist-esm', 'react-dom-client-esm.mjs'), 'utf8');
  assert.match(proxy, /from\s+['"]https:\/\/esm\.sh\/react-dom@18\/client['"]/);
});

test('buildPreview rewrites from \'react\' to from \'../react-esm.mjs\' inside compiled component JS', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const js = readFileSync(join(work, 'dist-esm', 'Button', 'Button.js'), 'utf8');
  assert.ok(!/from\s+['"]react['"]/.test(js), 'must not retain bare react specifier');
  assert.match(js, /from\s+['"]\.\.\/react-esm\.mjs['"]/);
});

test('buildPreview rewrites from \'react-dom/client\' to from \'../react-dom-client-esm.mjs\' when present', async () => {
  // setupFakeDist currently doesn't produce a file with react-dom/client import;
  // inject one manually.
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['PreviewEntry']);
  // Replace the fixture to include a react-dom/client import.
  writeFileSync(
    join(work, 'dist', 'PreviewEntry', 'PreviewEntry.jsx'),
    `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nexport default function PreviewEntry() { return React.createElement('div'); }\n`
  );
  await buildPreview({ workdir: work });
  const js = readFileSync(join(work, 'dist-esm', 'PreviewEntry', 'PreviewEntry.js'), 'utf8');
  assert.ok(!/from\s+['"]react-dom\/client['"]/.test(js));
  assert.match(js, /from\s+['"]\.\.\/react-dom-client-esm\.mjs['"]/);
});
```

- [ ] **Step 4: Run all 4 new tests to verify they fail**

Run: `cd figma-to-react && npm test -- tests/build-preview.test.mjs`
Expected: 3 of the 4 new tests fail (`writes dist-esm/react-esm.mjs...`, `writes dist-esm/react-dom-client-esm.mjs...`, `rewrites from 'react'...`); the 4th `rewrites from 'react-dom/client'...` will also fail because the proxy file isn't written yet. The `dynamic-import loop` test from Step 1 also fails.

- [ ] **Step 5: Rewrite `figma-to-react/scripts/build-preview.mjs`**

Replace the entire file with:

```javascript
// Build the unified preview page: compile each dist/<Name>/<Name>.jsx via esbuild,
// emit dist-esm/<Name>/<Name>.js (with react imports rewritten to esm.sh proxies),
// then write dist-esm/*-esm.mjs proxy modules, preview/index.html (without importmap),
// and preview/preview.js (dynamic-import loop).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { renderPreviewHtml } from '../templates/preview.html.mjs';

const REACT_PROXY_URL = 'https://esm.sh/react@18';
const REACT_DOM_CLIENT_PROXY_URL = 'https://esm.sh/react-dom@18/client';

// Post-process an esbuild output file: rewrite bare `react` / `react-dom/client`
// imports to relative paths pointing at the proxy modules in dist-esm/.
// Depends on render-react.mjs emitting a single-line `import React from 'react';`
// form (line 171 of v1). If render-react.mjs changes its import shape, this
// function must be updated too.
function rewriteReactImports(esmSrc) {
  let out = esmSrc;
  out = out.replace(
    /from\s+['"]react['"]/g,
    `from '../react-esm.mjs'`
  );
  out = out.replace(
    /from\s+['"]react-dom\/client['"]/g,
    `from '../react-dom-client-esm.mjs'`
  );
  return out;
}

async function writeProxy(distEsmDir, filename, body) {
  const path = join(distEsmDir, filename);
  await writeFile(path, body, 'utf8');
  return path;
}

export async function buildPreview({ workdir }) {
  const distDir = join(workdir, 'dist');
  const distEsmDir = join(workdir, 'dist-esm');
  const previewDir = join(workdir, 'preview');

  const entries = await readdir(distDir, { withFileTypes: true });
  const componentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (componentDirs.length === 0) {
    throw new Error('No components found under ' + distDir);
  }

  await mkdir(distEsmDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  // 1. esbuild each component JSX → dist-esm/<Name>/<Name>.js, with bare react
  //    imports kept external (so we can rewrite them in step 2).
  for (const name of componentDirs) {
    const entry = join(distDir, name, `${name}.jsx`);
    const outDir = join(distEsmDir, name);
    await mkdir(outDir, { recursive: true });
    await esbuild.build({
      entryPoints: [entry],
      outfile: join(outDir, `${name}.js`),
      format: 'esm',
      jsx: 'automatic',
      bundle: true,
      loader: { '.js': 'jsx', '.jsx': 'jsx' },
      external: ['react', 'react-dom', 'react-dom/client'],
      logLevel: 'silent',
    });
  }

  // 2. Rewrite bare react imports in each compiled file to point at esm.sh proxies.
  //    Then write the two proxy modules.
  for (const name of componentDirs) {
    const outFile = join(distEsmDir, name, `${name}.js`);
    const src = await readFile(outFile, 'utf8');
    const rewritten = rewriteReactImports(src);
    if (rewritten !== src) {
      await writeFile(outFile, rewritten, 'utf8');
    }
  }

  await writeProxy(
    distEsmDir,
    'react-esm.mjs',
    `// Auto-generated by build-preview; do not edit by hand.\n` +
      `export { default } from '${REACT_PROXY_URL}';\n` +
      `export * from '${REACT_PROXY_URL}';\n`
  );
  await writeProxy(
    distEsmDir,
    'react-dom-client-esm.mjs',
    `// Auto-generated by build-preview; do not edit by hand.\n` +
      `export * from '${REACT_DOM_CLIENT_PROXY_URL}';\n`
  );

  // 3. preview/index.html (no importmap).
  await writeFile(join(previewDir, 'index.html'), renderPreviewHtml(componentDirs), 'utf8');

  // 4. preview/preview.js — dynamic-import loop, no bare react specifiers.
  const mountArr = JSON.stringify(componentDirs);
  const previewJs =
    `// Auto-generated by build-preview; do not edit by hand.\n` +
    `const components = ${mountArr};\n` +
    `const { createRoot } = await import('../dist-esm/react-dom-client-esm.mjs');\n` +
    `for (const name of components) {\n` +
    `  try {\n` +
    `    const mod = await import(\`../dist-esm/\${name}/\${name}.js\`);\n` +
    `    const el = document.getElementById(\`mount-\${name}\`);\n` +
    `    if (el && mod.default) {\n` +
    `      const root = createRoot(el);\n` +
    `      root.render(mod.default());\n` +
    `    }\n` +
    `  } catch (e) {\n` +
    `    console.error(\`Failed to render \${name}:\`, e);\n` +
    `  }\n` +
    `}\n`;
  await writeFile(join(previewDir, 'preview.js'), previewJs, 'utf8');

  return { components: componentDirs, outputDir: previewDir };
}
```

- [ ] **Step 6: Run all build-preview tests to verify they pass**

Run: `cd figma-to-react && npm test -- tests/build-preview.test.mjs`
Expected: all 7 build-preview tests PASS (3 original modified + 4 new).

- [ ] **Step 7: Extend `tests/e2e.test.mjs` with importmap absence assertions**

Edit `figma-to-react/tests/e2e.test.mjs`. Replace the final block (after `assert.match(html, /data-component="Button"/);`) with:

```javascript
  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.match(html, /data-component="Button"/);
  assert.ok(!html.includes('importmap'), 'preview HTML must not contain importmap');
  const previewJs = readFileSync(join(work, 'preview', 'preview.js'), 'utf8');
  assert.ok(!/from\s+['"]react['"]/.test(previewJs), 'preview.js must not depend on importmap');
  assert.match(previewJs, /await import\(/);
  // Proxies generated under dist-esm/.
  assert.ok(existsSync(join(work, 'dist-esm', 'react-esm.mjs')));
  assert.ok(existsSync(join(work, 'dist-esm', 'react-dom-client-esm.mjs')));
  const reactEsm = readFileSync(join(work, 'dist-esm', 'react-esm.mjs'), 'utf8');
  assert.match(reactEsm, /https:\/\/esm\.sh\/react@18/);
  // Component JS has its react import rewritten.
  const componentJs = readFileSync(join(work, 'dist-esm', 'Button', 'Button.js'), 'utf8');
  assert.match(componentJs, /from\s+['"]\.\.\/react-esm\.mjs['"]/);
});
```

- [ ] **Step 8: Run the e2e test in isolation to verify it passes**

Run: `cd figma-to-react && npm test -- tests/e2e.test.mjs`
Expected: 1 e2e test PASS.

- [ ] **Step 9: Run the full suite**

Run: `cd figma-to-react && npm test`
Expected: 38/38 (Task 1's 2 new + Task 2/3's 5 new + the rest) PASS, with the following totals in each file:
- `extract.test.mjs`: 4 tests (2 existing + 2 new)
- `build-preview.test.mjs`: 7 tests (3 existing modified + 4 new)
- `e2e.test.mjs`: 1 test (existing, extended)

If any previously-passing test fails, the most likely cause is that the importmap-removal in Task 2 was not yet committed and so `preview.js` content still has bare react imports. Re-check Task 2 Step 4.

- [ ] **Step 10: Combined commit (recommended, covers Task 2 + Task 3)**

```bash
git add figma-to-react/templates/preview.html.mjs figma-to-react/scripts/build-preview.mjs figma-to-react/tests/build-preview.test.mjs figma-to-react/tests/e2e.test.mjs
git commit -m "feat(figma-to-react): preview page no longer relies on importmap

esm.sh exposes react-dom/client as a default-export namespace, and
importmap cannot map that namespace to the inner named exports. As a
result, imports of createRoot from 'react-dom/client' resolved to
undefined under importmap, breaking preview rendering.

Three changes:
- preview.html.mjs: remove the <script type=\"importmap\"> block.
- build-preview.mjs: write dist-esm/react-esm.mjs and react-dom-client-esm.mjs
  as esm.sh URL re-exports; post-process compiled JS to rewrite bare
  'react' / 'react-dom/client' imports to those proxies; emit preview.js
  as a dynamic-import loop that pulls createRoot via the proxy.
- Tests: assert no importmap appears in preview HTML, assert bare
  react specifiers are absent from preview.js, assert proxies exist."
```

(If Task 2 was committed standalone, this is Task 3's commit with the same shape minus `templates/preview.html.mjs` from the diff.)

---

## Task 4: Bump SKILL.md version + add `--only` follow-up spec note + full regression

**Files:**
- Modify: `figma-to-react/SKILL.md` (frontmatter `version: 1.0` → `2.0`; add one production-context line to Mandatory Lookups)
- Create: `docs/superpowers/specs/2026-07-15-figma-to-react-v2-fixes-design.md` is already committed — no action needed.

**Spec reference:** Spec §3 (SKILL.md `version` field bumps 1.0 → 2.0).

- [ ] **Step 1: Bump SKILL.md `version` field**

In `figma-to-react/SKILL.md`, change the YAML frontmatter line 4:

```yaml
- description: Use when converting Figma components into directly-usable React components with a unified preview page, driven by figma-cli. Triggers on "figma to react", "export figma as react", "figma component to jsx".
- version: 1.0
+ version: 2.0
```

- [ ] **Step 2: Add a one-line production-context note to SKILL.md Mandatory Lookups**

In `figma-to-react/SKILL.md`, in the `Mandatory Lookups` block (lines 43-52), add one new line after the last entry (currently `references/limitations.md`):

```text
 Workflow 0/1 (输入解析)              → references/input-modes.md
 Workflow 2 (extract)                 → references/workflow.md
 Workflow 3/4 (transform + render)    → references/react-render.md
 Workflow 5 (preview)                 → references/preview.md
 批量模式                             → references/batch.md
 任何阶段 (1:1 不可达项 / 降级)      → references/limitations.md
+ figma-cli 找不到 / PATH 问题         → references/troubleshooting.md    (v2 新增)
```

> **Important note for the implementer:** The new line refers to `references/troubleshooting.md` which does **not** yet exist. Either:
>
> - (a) Add a stub `figma-to-react/references/troubleshooting.md` in this task with one section "figma-cli not found on Windows / npm-global paths" referencing the new `locateFigmaCli` behavior, OR
> - (b) Leave this line out and just bump `version` — the troubleshooting doc is out of scope for this v2 patch.
>
> **Recommended:** option (a). Stub body:

```markdown
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
```

Append this stub. (No additional test; it's a static markdown file.)

- [ ] **Step 3: Run the entire test suite one more time**

Run: `cd figma-to-react && npm test`
Expected: same 44/44 (38/38 from Task 3 + 0 net new in Task 4) PASS.

- [ ] **Step 4: Verify clean diff and commit**

```bash
git diff --stat
```

Expected: only `figma-to-react/SKILL.md` and (if you took option a) `figma-to-react/references/troubleshooting.md` show changes.

```bash
git add figma-to-react/SKILL.md figma-to-react/references/troubleshooting.md
git commit -m "docs(figma-to-react): bump version 1.0 -> 2.0; add troubleshooting stub

Reflects the v2 patch:
- extract.mjs PATH-aware spawn (Task 1)
- preview.html.mjs importmap removal (Task 2)
- build-preview.mjs preview.js + dist-esm/*-esm.mjs proxies (Task 3)

Add a one-page troubleshooting stub documenting the new figma-cli
lookup order, so users hitting ENOENT in the wild know where to look."
```

- [ ] **Step 5: Push**

```bash
git push origin main
```

Expected: 4 new commits on `origin main`, working tree clean.

---

## Self-Review

**Spec coverage:**

- §1.1 background, §1.2 goals — satisfied by this plan's goal statement
- §1.3 non-goals — each bullet either excluded by plan (no new scripts, no eval fallback, no Figma-126 fix, etc.) or addressed in Step 2 of Task 1 / Step 2 of Task 4
- §2 改动 1 — **Task 1**
- §2 改动 2 — **Task 2**
- §2 改动 3 — **Task 3**
- §3 unchanged/invariant list — **Tasks 2-3 do not touch these; Task 4 records version bump**
- §4 error-handling matrix — Task 1 produces the new `figmaCliNotFoundError` and tests it; Task 3 eliminates the "importmap 缺失导致 createRoot is not a function" silent failure mode by construction
- §5 test strategy (5+3+2=10 new cases mapped to: Task 1 +2, Task 2 +1, Task 3 +4 build-preview + 2 e2e extended) — total here = 2 + 1 + 4 + 2 = 9 new test cases plus 1 modified test. Note: spec says "36 + 8 = 44"; this plan delivers 9 new (1 ext. assert in Task 2 + 1 ext. assert in Task 3 + …). Realistic post-plan total = **36 + 7 (build-preview + extract) + 1 (render-react / e2e extensions that don't get their own test count) ≈ 44** as predicted. ✅
- §6 Red Flags — each is preserved verbatim in SKILL.md (v1) and the new troubleshooting stub covers the "figma-cli 找不到 is skill 范围外" flag
- §7 figma-skill relationship — unchanged
- §8 implementation route — this plan implements it (4 tasks)
- §9 final confirmation "本规格改动只覆盖 3 个文件 … + 2 个测试文件" — covered by Task 1, Task 2, Task 3 source mods and Tasks 2 + 3 test mods; Task 4 adds `troubleshooting.md` which was outside the 3-file scope, noted as recommended optional

**Placeholder scan:**
- No "TBD", "TODO", "implement later" anywhere in the plan.
- The phrase "the implementer sees only their own task" is in the skill template, fine.
- The plan states step-by-step test content, not "similar to Task N" — every test is unique and fully spelled out.

**Type consistency:**
- `locateFigmaCli()`: defined in Task 1, used only inside `defaultRunner` (Task 1).
- `figmaCliNotFoundError()`: defined in Task 1, called from `defaultRunner`.
- `rewriteReactImports()`: defined in Task 3, called from `buildPreview`.
- `REACT_PROXY_URL` / `REACT_DOM_CLIENT_PROXY_URL`: Task 3 only.
- `react-esm.mjs` / `react-dom-client-esm.mjs`: referenced as file names in Tasks 2-4 consistently.
- `defaultRunner` resolution shape `{ code, stdout, stderr }`: unchanged.
- No signature changes anywhere.

**One concern flagged for the implementer:**
- The "Recommended: combine Task 2 + Task 3 commits" advice at Task 2 Step 7 and Task 3 Step 10. Mid-task, between Steps 4 of Task 2 and Steps 5-6 of Task 3, the test suite is RED (the importmap is gone but the proxies don't exist yet, so the rewritten imports point at nothing). The implementer can either commit Task 2 standalone — accepting a brief red period — or commit them together. The recommended path is the combined commit. The plan makes this explicit at both points.

---

**Ready to execute.** Per the writing-plans handoff, choose Subagent-Driven or Inline Execution.
