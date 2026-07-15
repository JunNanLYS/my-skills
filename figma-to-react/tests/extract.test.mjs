import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extract } from '../scripts/extract.mjs';

const stubRunner = async function(args) {
  stubRunner.calls.push(args);
  if (args[0] === 'export-jsx') {
    return { stdout: `<Frame name="Stub" width={10} height={10} direction="horizontal" />`, code: 0 };
  }
  if (args[0] === 'export') {
    return { stdout: ':root { --color-primary: #000; }', code: 0 };
  }
  return { stdout: '', code: 0 };
};
stubRunner.calls = [];

test('extract calls export-jsx for each node and writes tmp/<id>.jsx', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  const result = await extract({ nodeIds: ['1:1', '1:2'], mode: 'daemon', workdir: work, runner: stubRunner });
  assert.equal(result.jsxFiles.length, 2);
  assert.ok(existsSync(join(work, 'tmp', '1-1.jsx')));
  assert.ok(existsSync(join(work, 'tmp', '1-2.jsx')));
});

test('extract writes tmp/tokens.css exactly once', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-'));
  const result = await extract({ nodeIds: ['1:1', '1:2'], mode: 'daemon', workdir: work, runner: stubRunner });
  assert.ok(existsSync(result.tokensFile));
  const css = readFileSync(result.tokensFile, 'utf8');
  assert.match(css, /--color-primary/);
});
