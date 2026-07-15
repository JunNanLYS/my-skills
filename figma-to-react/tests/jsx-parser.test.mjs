import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseJsx } from '../scripts/jsx-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, 'fixtures', 'simple-frame.jsx'), 'utf8');

test('parseJsx returns root Element with tag Frame', () => {
  const ast = parseJsx(fixture);
  assert.equal(ast.type, 'Element');
  assert.equal(ast.tag, 'Frame');
});

test('parseJsx extracts top-level props (name, width, height)', () => {
  const ast = parseJsx(fixture);
  assert.equal(ast.props.name, 'Button');
  assert.equal(ast.props.width, 328);
  assert.equal(ast.props.height, 56);
});

test('parseJsx returns 2 children for simple-frame', () => {
  const ast = parseJsx(fixture);
  assert.equal(ast.children.length, 2);
  assert.equal(ast.children[0].tag, 'Rectangle');
  assert.equal(ast.children[1].tag, 'Text');
});

test('parseJsx extracts text content of Text node', () => {
  const ast = parseJsx(fixture);
  const text = ast.children[1];
  assert.equal(text.children.length, 1);
  assert.equal(text.children[0].type, 'Text');
  assert.equal(text.children[0].value, 'Button label');
});

const nestedFixture = readFileSync(join(__dirname, 'fixtures', 'nested-frames.jsx'), 'utf8');

test('parseJsx handles nested frames without crashing', () => {
  const ast = parseJsx(nestedFixture);
  assert.equal(ast.type, 'Element');
  assert.equal(ast.tag, 'Frame');
  assert.equal(ast.props.name, 'Card');
});

test('parseJsx produces correct AST shape for nested-frames', () => {
  const ast = parseJsx(nestedFixture);
  assert.equal(ast.children.length, 2);
  assert.equal(ast.children[0].type, 'Element');
  assert.equal(ast.children[0].tag, 'Frame');
  assert.equal(ast.children[0].props.name, 'header');
  // The body Text is wrapped in a <Text> element (Element, not Text node).
  assert.equal(ast.children[1].type, 'Element');
  assert.equal(ast.children[1].tag, 'Text');
  // Its text content is a child Text node.
  assert.equal(ast.children[1].children.length, 1);
  assert.equal(ast.children[1].children[0].type, 'Text');
  assert.equal(
    ast.children[1].children[0].value,
    'This is a longer description that wraps onto two lines.'
  );
});
