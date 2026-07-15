import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview } from '../scripts/build-preview.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function setupFakeDist(root, names) {
  for (const n of names) {
    const dir = join(root, 'dist', n);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${n}.jsx`), `import React from 'react';\nexport default function ${n}() { return <div />; }\n`);
  }
}

test('buildPreview writes preview/index.html with one section per component', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button', 'Card']);
  const result = await buildPreview({ workdir: work });
  assert.equal(result.components.length, 2);
  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.match(html, /data-component="Button"/);
  assert.match(html, /data-component="Card"/);
});

test('buildPreview writes preview/preview.js as a dynamic-import loop (no bare react specifiers)', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const js = readFileSync(join(work, 'preview', 'preview.js'), 'utf8');
  // Dynamic import, not static.
  assert.match(js, /await import\(`\.\.\/dist-esm\/\$\{name\}\/\$\{name\}\.js`\)/);
  // No bare react specifiers.
  assert.ok(!/from\s+['"]react['"]/.test(js), 'preview.js must not depend on importmap');
  assert.ok(!/from\s+['"]react-dom\/client['"]/.test(js));
  // createRoot is pulled via the proxy.
  assert.match(js, /react-dom-client-esm\.mjs/);
});

test('buildPreview writes dist-esm/<Name>/<Name>.js after esbuild compile', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  assert.ok(existsSync(join(work, 'dist-esm', 'Button', 'Button.js')));
});

test('renderPreviewHtml does not emit an importmap block', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.ok(!html.includes('importmap'), 'preview HTML must not contain importmap');
});

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
