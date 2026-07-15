import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transformJsx } from '../scripts/transform.mjs';
import { collectBridges } from '../scripts/bridges.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('collectBridges records vector nodes as flattened', async () => {
  const source = `<Frame name="X" width={100} height={100} direction="horizontal"><Vector name="shape" width={20} height={20} /></Frame>`;
  const ir = await transformJsx(source, { name: 'X', nodeId: '1:2' });
  const bridges = collectBridges(ir);
  const flattened = bridges.bridges.filter(b => b.kind === 'flattened');
  assert.ok(flattened.length >= 1);
  assert.equal(flattened[0].kind, 'flattened');
  assert.match(flattened[0].reason, /vector/);
});

test('collectBridges records font-missing for text nodes with fontFamily', async () => {
  const source = `<Frame name="X" width={100} height={100} direction="horizontal"><Text name="t" fontFamily="Inter" fontSize={14}>hi</Text></Frame>`;
  const ir = await transformJsx(source, { name: 'X' });
  const bridges = collectBridges(ir);
  const fonts = bridges.bridges.filter(b => b.kind === 'font-missing');
  assert.ok(fonts.length >= 1);
  assert.match(fonts[0].reason, /Inter/);
});

test('collectBridges returns the component name', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'simple-frame.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Button' });
  const bridges = collectBridges(ir);
  assert.equal(bridges.component, 'Button');
});
