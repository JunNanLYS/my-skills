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

test('buildPreview writes preview/preview.js that imports each compiled component', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  setupFakeDist(work, ['Button']);
  await buildPreview({ workdir: work });
  const js = readFileSync(join(work, 'preview', 'preview.js'), 'utf8');
  assert.match(js, /import Button/);
  assert.match(js, /createRoot/);
  assert.match(js, /Button/);
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
