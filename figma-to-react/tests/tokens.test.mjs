import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTokensCss } from '../scripts/tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('parseTokensCss returns map of token name to value', () => {
  const css = readFileSync(join(__dirname, 'fixtures', 'tokens.css'), 'utf8');
  const tokens = parseTokensCss(css);
  assert.equal(tokens.get('--color-primary'), '#3B82F6');
  assert.equal(tokens.get('--color-text-primary'), '#111827');
  assert.equal(tokens.get('--radius-md'), '8px');
});

test('parseTokensCss on empty string returns empty map', () => {
  const tokens = parseTokensCss('');
  assert.equal(tokens.size, 0);
});
