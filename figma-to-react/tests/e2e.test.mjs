import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../scripts/orchestrate.mjs';

test('end-to-end: a single node → dist/<Name>/ + preview/ + dist-esm/', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-e2e-'));

  // Stub runner: simulate daemon mode + two-step export.
  const stub = {
    async run(args) {
      if (args[0] === 'status') return { code: 0, stdout: 'daemon-running\n' };
      if (args[0] === 'config') return { code: 0, stdout: 'token=***\n' };
      if (args[0] === 'export' && args[1] === 'css') {
        return { code: 0, stdout: ':root { --color-primary: #3B82F6; }' };
      }
      if (args[0] === 'export-jsx') {
        return {
          code: 0,
          stdout: `<Frame name="Button" width={120} height={40} padding={8} direction="horizontal" fill="#FFFFFF" cornerRadius={6}>
            <Text name="label" fontSize={14} fontWeight={500} fill="#111827">Click</Text>
          </Frame>`,
        };
      }
      return { code: 0, stdout: '' };
    },
  };

  await main(['--file-key', 'XYZ', '--node', '1:1', '--workdir', work], { runner: stub });

  assert.ok(existsSync(join(work, 'dist', 'Button', 'Button.jsx')));
  assert.ok(existsSync(join(work, 'dist', 'Button', 'Button.figma-bridges.json')));
  assert.ok(existsSync(join(work, 'preview', 'index.html')));
  assert.ok(existsSync(join(work, 'preview', 'preview.js')));
  assert.ok(existsSync(join(work, 'dist-esm', 'Button', 'Button.js')));

  const jsx = readFileSync(join(work, 'dist', 'Button', 'Button.jsx'), 'utf8');
  assert.match(jsx, /export default function Button\(\)/);
  assert.match(jsx, /flexDirection: 'row'/);

  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.match(html, /data-component="Button"/);
});
