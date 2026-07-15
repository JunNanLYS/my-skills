import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transformJsx } from '../scripts/transform.mjs';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('transform simple-frame.jsx → IR has type=frame root with name=Button', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'simple-frame.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Button', nodeId: '1:1' });
  assert.equal(ir.name, 'Button');
  assert.equal(ir.nodeId, '1:1');
  assert.equal(ir.root.type, 'frame');
  assert.equal(ir.root.name, 'Button');
  assert.equal(ir.root.layoutMode, 'horizontal');
});

test('transform simple-frame → IR has 2 children: rectangle and text', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'simple-frame.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Button' });
  assert.equal(ir.root.children.length, 2);
  assert.equal(ir.root.children[0].type, 'rectangle');
  assert.equal(ir.root.children[0].name, 'icon');
  assert.equal(ir.root.children[1].type, 'text');
  assert.equal(ir.root.children[1].text, 'Button label');
});

test('transform nested-frames.jsx → vertical root with two children, both frames', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'nested-frames.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Card' });
  assert.equal(ir.root.layoutMode, 'vertical');
  assert.equal(ir.root.children.length, 2);
  assert.equal(ir.root.children[0].type, 'frame');
  assert.equal(ir.root.children[1].type, 'text');
});

test('transform rejects unknown element tag with a clear error', async () => {
  const bad = '<Unknown name="x" />';
  await assert.rejects(() => transformJsx(bad, { name: 'X' }), /Unknown Figma element/);
});

test('transform simple-frame → text node has no phantom text child', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'simple-frame.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Button' });
  const textNode = ir.root.children[1];
  assert.equal(textNode.type, 'text');
  assert.equal(textNode.text, 'Button label');
  // Phantom child must not exist: children key absent or empty
  assert.ok(
    !('children' in textNode) || textNode.children.length === 0,
    'text node must not have a phantom text child in children'
  );
});

test('transform nested-frames → body text node has no phantom text child', async () => {
  const source = readFileSync(join(__dirname, 'fixtures', 'nested-frames.jsx'), 'utf8');
  const ir = await transformJsx(source, { name: 'Card' });
  const bodyNode = ir.root.children[1];
  assert.equal(bodyNode.type, 'text');
  assert.equal(bodyNode.text, 'This is a longer description that wraps onto two lines.');
  assert.ok(
    !('children' in bodyNode) || bodyNode.children.length === 0,
    'text node must not have a phantom text child in children'
  );
});
