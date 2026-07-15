import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transformJsx } from '../scripts/transform.mjs';
import { parseTokensCss } from '../scripts/tokens.mjs';
import { renderReactComponent } from '../scripts/render-react.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadIr(name) {
  const source = readFileSync(join(__dirname, 'fixtures', name + '.jsx'), 'utf8');
  return transformJsx(source, { name });
}

test('renderReactComponent emits default-export function with component name', async () => {
  const ir = await loadIr('simple-frame');
  const out = renderReactComponent(ir, new Map());
  assert.match(out, /export default function Button\(\)/);
});

test('renderReactComponent emits flexbox style for horizontal layout', async () => {
  const ir = await loadIr('simple-frame');
  const out = renderReactComponent(ir, new Map());
  assert.match(out, /display: 'flex'/);
  assert.match(out, /flexDirection: 'row'/);
  assert.match(out, /gap: '8px'/);
  assert.match(out, /padding: '16px'/);
});

test('renderReactComponent emits flexbox column for vertical layout', async () => {
  const ir = await loadIr('nested-frames');
  const out = renderReactComponent(ir, new Map());
  assert.match(out, /flexDirection: 'column'/);
});

test('renderReactComponent wraps text in <span> with fontSize+color', async () => {
  const ir = await loadIr('simple-frame');
  const out = renderReactComponent(ir, new Map());
  assert.match(out, /<span/);
  assert.match(out, /fontSize: 14/);
  assert.match(out, /color: '#111827'/);
  assert.match(out, /Button label/);
});

test('renderReactComponent uses var(--token, fallback) when token map provides it', async () => {
  const ir = await loadIr('simple-frame');
  // Override the IR's fill values to reference a token by adding a custom IR.
  ir.root.style = { ...ir.root.style, fill: '__token:color-bg-default' };
  const tokens = new Map([['--color-bg-default', '#FFFFFF']]);
  const out = renderReactComponent(ir, tokens);
  assert.match(out, /var\(--color-bg-default, #FFFFFF\)/);
});

test('renderReactComponent numbers in style get px units (e.g. borderRadius)', async () => {
  const ir = await loadIr('simple-frame');
  const out = renderReactComponent(ir, new Map());
  assert.match(out, /borderRadius: '8px'/);
});
