# `figma-to-react` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `figma-to-react` skill that converts Figma components into directly-usable React components (with inline style) and renders them on a unified preview page, all driven by `figma-cli`.

**Architecture:** Seven small Node.js modules with single responsibilities. `extract.mjs` is the only module that shells out to `figma-cli`; all others are pure functions over JSON/fixtures and are unit-testable. End-to-end orchestration lives in `orchestrate.mjs`. Tokens are pulled via `figma-cli export css` and emitted as CSS custom property references with hardcoded fallbacks. JSX is precompiled to ESM via esbuild so the browser never needs a JSX runtime.

**Tech Stack:** Node.js 20+ (ESM only), `figma-cli` 2.x (external), `esbuild ^0.24.0` (devDep), JSON Schema validation via `ajv ^8.17.0` (devDep), Vitest for unit tests (devDep, optional but recommended).

## Global Constraints

- ESM only (`"type": "module"` in `package.json`); no CommonJS, no TypeScript.
- Node.js engine: `>=20`.
- All Figma access goes through `figma-cli`; no direct REST API or MCP fallback.
- React output uses inline `style={{...}}` only; no CSS files are emitted for components (only an optional `tokens.css` for CSS custom property definitions).
- Preview page is exactly one `preview/index.html`; per-component previews are forbidden.
- esbuild fixed at `^0.24.0`; must be declared in `devDependencies`.
- All hard rules use "必须 / 禁止 / 只有……才允许" wording in `SKILL.md` and `references/*.md`.
- `--url` must include a `node-id` parameter; URL with only a file key is rejected.
- Auto-layout Frames must map to flexbox; non-auto-layout Frames must map to relative-positioned `<div>` with absolutely-positioned children.
- Numeric CSS values get `'Xpx'` units; never bare numbers in `style={{...}}`.
- Figma variables render as `'var(--token-name, #fallback)'`; never as raw fallback without the `var()` wrapper.

---

## Task 1: 技能骨架(package.json + 目录 + gitkeep)

**Files:**
- Create: `figma-to-react/package.json`
- Create: `figma-to-react/scripts/.gitkeep`
- Create: `figma-to-react/schemas/.gitkeep`
- Create: `figma-to-react/templates/.gitkeep`
- Create: `figma-to-react/tests/.gitkeep`
- Create: `figma-to-react/references/.gitkeep`
- Create: `figma-to-react/.gitignore`

**Interfaces:** None (skeleton task).

- [ ] **Step 1: Create the directory structure**

Run from repo root:

```bash
mkdir -p figma-to-react/scripts
mkdir -p figma-to-react/schemas
mkdir -p figma-to-react/templates
mkdir -p figma-to-react/tests/fixtures
mkdir -p figma-to-react/references
touch figma-to-react/scripts/.gitkeep
touch figma-to-react/schemas/.gitkeep
touch figma-to-react/templates/.gitkeep
touch figma-to-react/tests/.gitkeep
touch figma-to-react/tests/fixtures/.gitkeep
touch figma-to-react/references/.gitkeep
```

- [ ] **Step 2: Create `figma-to-react/.gitignore`**

```gitignore
node_modules/
dist/
dist-esm/
preview/
tmp/
*.log
.DS_Store
```

- [ ] **Step 3: Create `figma-to-react/package.json`**

```json
{
  "name": "figma-to-react",
  "version": "1.0.0",
  "description": "Convert Figma components into directly-usable React components with a unified preview page, driven by figma-cli.",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "bin": {
    "figma-to-react": "./scripts/orchestrate.mjs"
  },
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "test:watch": "node --test --watch tests/*.test.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.1",
    "esbuild": "^0.24.0"
  }
}
```

- [ ] **Step 4: Verify the skeleton**

Run: `ls figma-to-react/`
Expected: lists `package.json`, `.gitignore`, `scripts/`, `schemas/`, `templates/`, `tests/`, `references/`

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/
git commit -m "feat(figma-to-react): scaffold skill directory and package.json"
```

---

## Task 2: IR Schema

**Files:**
- Create: `figma-to-react/schemas/ir.schema.json`

**Interfaces:**
- Consumes: nothing
- Produces: `ir.schema.json` conforming to JSON Schema draft 2020-12. Used by `transform.mjs` and `render-react.mjs` for validation.

- [ ] **Step 1: Write the schema file**

Create `figma-to-react/schemas/ir.schema.json` with the following exact content:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ai-skills.local/figma-to-react/ir.schema.json",
  "type": "object",
  "required": ["name", "root"],
  "additionalProperties": false,
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "nodeId": { "type": "string" },
    "width": { "type": "number", "minimum": 0 },
    "height": { "type": "number", "minimum": 0 },
    "tokens": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "root": { "$ref": "#/$defs/node" },
    "bridges": {
      "type": "array",
      "items": { "$ref": "#/$defs/bridge" }
    }
  },
  "$defs": {
    "node": {
      "type": "object",
      "required": ["type"],
      "additionalProperties": true,
      "properties": {
        "type": {
          "enum": ["frame", "rectangle", "ellipse", "text", "image", "vector", "group"]
        },
        "name": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number", "minimum": 0 },
        "height": { "type": "number", "minimum": 0 },
        "layoutMode": {
          "enum": ["horizontal", "vertical", "none", "HORIZONTAL", "VERTICAL", "NONE"]
        },
        "primaryAxisAlignItems": { "type": "string" },
        "counterAxisAlignItems": { "type": "string" },
        "padding": { "$ref": "#/$defs/padding" },
        "gap": { "type": "number", "minimum": 0 },
        "style": { "type": "object" },
        "text": { "type": "string" },
        "src": { "type": "string" },
        "children": {
          "type": "array",
          "items": { "$ref": "#/$defs/node" }
        }
      }
    },
    "padding": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "top": { "type": "number" },
        "right": { "type": "number" },
        "bottom": { "type": "number" },
        "left": { "type": "number" }
      }
    },
    "bridge": {
      "type": "object",
      "required": ["nodeId", "kind"],
      "additionalProperties": false,
      "properties": {
        "nodeId": { "type": "string" },
        "kind": {
          "enum": ["flattened", "needs-rewrite", "font-missing", "effect-lossy"]
        },
        "reason": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 2: Validate the schema parses**

Run:

```bash
node -e "import('fs').then(fs => { JSON.parse(fs.readFileSync('figma-to-react/schemas/ir.schema.json','utf8')); console.log('OK'); })"
```

Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add figma-to-react/schemas/ir.schema.json
git commit -m "feat(figma-to-react): add IR JSON schema"
```

---

## Task 3: Fixture — single Frame with two children

**Files:**
- Create: `figma-to-react/tests/fixtures/simple-frame.jsx`

**Interfaces:** Fixture consumed by `transform.test.mjs` (later tasks). Format mimics `figma-cli export-jsx` output for a small Frame containing a Rectangle and a Text.

- [ ] **Step 1: Write the fixture**

Create `figma-to-react/tests/fixtures/simple-frame.jsx`:

```jsx
<Frame name="Button" width={328} height={56} padding={16} gap={8}
       direction="horizontal" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={1}
       cornerRadius={8}>
  <Rectangle name="icon" width={24} height={24} fill="#3B82F6" cornerRadius={4} />
  <Text name="label" fontSize={14} fontWeight={500} lineHeight={20} fill="#111827">
    Button label
  </Text>
</Frame>
```

- [ ] **Step 2: Commit**

```bash
git add figma-to-react/tests/fixtures/simple-frame.jsx
git commit -m "test(figma-to-react): add simple-frame export-jsx fixture"
```

---

## Task 4: Fixture — Frame with auto-layout vertical + nested Frame

**Files:**
- Create: `figma-to-react/tests/fixtures/nested-frames.jsx`

**Interfaces:** Fixture for a vertical auto-layout Frame containing two child Frames.

- [ ] **Step 1: Write the fixture**

Create `figma-to-react/tests/fixtures/nested-frames.jsx`:

```jsx
<Frame name="Card" width={320} height={200} padding={20} gap={12}
       direction="vertical" fill="#FAFAFA" cornerRadius={12}>
  <Frame name="header" width={280} height={40} gap={8}
         direction="horizontal" fill="#FFFFFF">
    <Rectangle name="avatar" width={32} height={32} fill="#10B981" cornerRadius={16} />
    <Text name="title" fontSize={16} fontWeight={700} fill="#111827">
      Card title
    </Text>
  </Frame>
  <Text name="body" fontSize={14} fontWeight={400} lineHeight={22} fill="#374151">
    This is a longer description that wraps onto two lines.
  </Text>
</Frame>
```

- [ ] **Step 2: Commit**

```bash
git add figma-to-react/tests/fixtures/nested-frames.jsx
git commit -m "test(figma-to-react): add nested-frames export-jsx fixture"
```

---

## Task 5: Fixture — tokens.css from figma-cli export css

**Files:**
- Create: `figma-to-react/tests/fixtures/tokens.css`

**Interfaces:** Fixture of CSS custom property definitions as produced by `figma-cli export css`. Consumed by `render-react.test.mjs` to verify variable mapping.

- [ ] **Step 1: Write the fixture**

Create `figma-to-react/tests/fixtures/tokens.css`:

```css
:root {
  --color-primary: #3B82F6;
  --color-text-primary: #111827;
  --color-bg-default: #FFFFFF;
  --color-border-default: #E5E7EB;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --radius-md: 8px;
}
```

- [ ] **Step 2: Commit**

```bash
git add figma-to-react/tests/fixtures/tokens.css
git commit -m "test(figma-to-react): add tokens.css fixture"
```

---

## Task 6: JSX parser (`transform.mjs` Part 1 — pure tokenizer)

**Files:**
- Create: `figma-to-react/scripts/jsx-parser.mjs`

**Interfaces:**
- Consumes: a JSX source string (such as the contents of an `export-jsx` output file)
- Produces: an AST shaped `{ type: 'Element' | 'Text', tag?, props, children, value? }` consumed by `transform.mjs` in the next task. Pure function. No filesystem access.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/jsx-parser.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/jsx-parser.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/jsx-parser.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/jsx-parser.mjs`**

```javascript
// Lightweight JSX parser tuned for figma-cli export-jsx output.
// Supports: element open/close, self-closing, props with string/number/boolean values,
// JSX expressions ({...}), and text children. No namespace, no fragments, no attributes with dashes.

const TAG_RE = /<([A-Z][A-Za-z0-9]*)\b([^>]*?)\/?>/g;
const PROP_STRING_RE = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"/g;
const PROP_EXPR_RE = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{([^}]*)\}/g;
const CLOSE_TAG_RE = /<\/([A-Z][A-Za-z0-9]*)\s*>/g;

function parseProps(attrString) {
  const props = {};
  for (const m of attrString.matchAll(PROP_STRING_RE)) {
    props[m[1]] = m[2];
  }
  for (const m of attrString.matchAll(PROP_EXPR_RE)) {
    const raw = m[2].trim();
    if (/^[-+]?\d+(\.\d+)?$/.test(raw)) {
      props[m[1]] = Number(raw);
    } else if (raw === 'true' || raw === 'false') {
      props[m[1]] = raw === 'true';
    } else if (/^['"][^'"]*['"]$/.test(raw)) {
      props[m[1]] = raw.slice(1, -1);
    } else {
      props[m[1]] = { __expr: raw };
    }
  }
  return props;
}

function tokenize(source) {
  // Returns an ordered list of tokens: open tags, close tags, and text.
  const tokens = [];
  let cursor = 0;

  while (cursor < source.length) {
    const openMatch = TAG_RE.exec(source.slice(cursor));
    if (!openMatch) {
      const rest = source.slice(cursor);
      if (rest.trim().length > 0) {
        tokens.push({ type: 'text', value: rest });
      }
      break;
    }
    const openIndex = cursor + openMatch.index;
    if (openIndex > cursor) {
      const between = source.slice(cursor, openIndex);
      if (between.trim().length > 0) {
        tokens.push({ type: 'text', value: between });
      }
    }

    const tag = openMatch[1];
    const attrString = openMatch[2];
    const isSelfClosing = openMatch[0].endsWith('/>');
    tokens.push({ type: 'open', tag, props: parseProps(attrString), selfClosing: isSelfClosing });

    cursor = openIndex + openMatch[0].length;

    if (!isSelfClosing) {
      // Find matching close tag, respecting nesting.
      let depth = 1;
      const localTag = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'g');
      localTag.lastIndex = cursor;
      let closeEnd = -1;
      let closeStart = -1;
      while (depth > 0) {
        const next = localTag.exec(source);
        if (!next) break;
        if (next[0].startsWith('</')) {
          depth -= 1;
          if (depth === 0) {
            closeStart = cursor + next.index;
            closeEnd = closeStart + next[0].length;
            break;
          }
        } else if (!next[0].endsWith('/>')) {
          depth += 1;
        }
      }
      if (closeStart === -1) {
        throw new Error(`Unclosed <${tag}> at offset ${openIndex}`);
      }
      if (closeStart > cursor) {
        const inner = source.slice(cursor, closeStart);
        if (inner.trim().length > 0) {
          tokens.push({ type: 'text', value: inner });
        }
      }
      tokens.push({ type: 'close', tag });
      cursor = closeEnd;
    }

    TAG_RE.lastIndex = cursor;
    CLOSE_TAG_RE.lastIndex = cursor;
  }

  return tokens;
}

function buildTree(tokens) {
  const root = { type: 'Element', tag: null, props: {}, children: [] };
  const stack = [root];

  for (const tok of tokens) {
    if (tok.type === 'open') {
      const node = { type: 'Element', tag: tok.tag, props: tok.props, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!tok.selfClosing) {
        stack.push(node);
      }
    } else if (tok.type === 'close') {
      if (stack.length > 1) stack.pop();
    } else if (tok.type === 'text') {
      const trimmed = tok.value.replace(/^\s+|\s+$/g, '');
      // Collapse intra-text whitespace per JSX rules: keep newlines that delimit non-whitespace runs.
      const runs = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
      for (const run of runs) {
        stack[stack.length - 1].children.push({ type: 'Text', value: run });
      }
    }
  }

  // If there is exactly one root child, hoist it.
  if (root.children.length === 1 && root.children[0].type === 'Element') {
    return root.children[0];
  }
  return root;
}

export function parseJsx(source) {
  const tokens = tokenize(source);
  return buildTree(tokens);
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/jsx-parser.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/jsx-parser.mjs figma-to-react/tests/jsx-parser.test.mjs
git commit -m "feat(figma-to-react): add lightweight JSX parser"
```

---

## Task 7: `transform.mjs` (JSX AST → IR)

**Files:**
- Create: `figma-to-react/scripts/transform.mjs`
- Create: `figma-to-react/tests/transform.test.mjs`

**Interfaces:**
- Consumes: source string (JSX), options `{ name?, nodeId?, tokens? }`
- Produces: IR object matching `schemas/ir.schema.json`. Pure function.
- Side effects: none.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/transform.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/transform.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/transform.mjs'`.

- [ ] **Step 3: Install ajv (only after package.json is committed in Task 1)**

Run: `cd figma-to-react && npm install --no-audit --no-fund`
Expected: installs `ajv`, `ajv-formats`, `esbuild` into `figma-to-react/node_modules/`.

- [ ] **Step 4: Implement `figma-to-react/scripts/transform.mjs`**

```javascript
// Transform a figma-cli export-jsx string into a validated IR object.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseJsx } from './jsx-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TAG_TO_TYPE = new Map([
  ['Frame', 'frame'],
  ['Rectangle', 'rectangle'],
  ['Ellipse', 'ellipse'],
  ['Text', 'text'],
  ['Image', 'image'],
  ['Vector', 'vector'],
  ['Group', 'group'],
]);

let _ajv;
let _validate;
async function loadValidator() {
  if (_validate) return _validate;
  _ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(_ajv);
  const schemaPath = join(__dirname, '..', 'schemas', 'ir.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  _validate = _ajv.compile(schema);
  return _validate;
}

function toNumberOrUndefined(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return undefined;
}

function pickProps(jsxProps) {
  // Convert the parser's prop dict (which may contain {__expr} for unsupported values)
  // into the IR's structured fields. Unknown values become entries in `style`.
  const out = { style: {} };
  for (const [k, v] of Object.entries(jsxProps)) {
    if (v && typeof v === 'object' && '__expr' in v) {
      out.style[k] = v.__expr;
    } else if (k === 'children') {
      continue;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mapNode(astNode) {
  if (astNode.type === 'Text') {
    return { type: 'text', text: astNode.value };
  }
  if (astNode.type !== 'Element') {
    throw new Error('Unexpected AST node type: ' + astNode.type);
  }
  const tag = astNode.tag;
  const mapped = TAG_TO_TYPE.get(tag);
  if (!mapped) {
    throw new Error(`Unknown Figma element <${tag}>. Supported: ${[...TAG_TO_TYPE.keys()].join(', ')}`);
  }
  const props = pickProps(astNode.props);
  const node = { type: mapped, name: props.name };

  // Geometry
  if ('x' in props) node.x = toNumberOrUndefined(props.x);
  if ('y' in props) node.y = toNumberOrUndefined(props.y);
  if ('width' in props) node.width = toNumberOrUndefined(props.width);
  if ('height' in props) node.height = toNumberOrUndefined(props.height);

  // Layout
  if (props.layoutMode) node.layoutMode = String(props.layoutMode).toLowerCase();
  if (props.direction) node.layoutMode = String(props.direction).toLowerCase();
  if ('primaryAxisAlignItems' in props) node.primaryAxisAlignItems = props.primaryAxisAlignItems;
  if ('counterAxisAlignItems' in props) node.counterAxisAlignItems = props.counterAxisAlignItems;
  if ('gap' in props) {
    const g = toNumberOrUndefined(props.gap);
    if (g !== undefined) node.gap = g;
  }
  if (props.padding !== undefined) {
    const p = toNumberOrUndefined(props.padding);
    if (p !== undefined) {
      node.padding = { top: p, right: p, bottom: p, left: p };
    }
  }

  // Visual style (pass-through; render-react interprets these)
  for (const k of ['fill', 'stroke', 'strokeWidth', 'cornerRadius', 'opacity']) {
    if (k in props) node.style = { ...node.style, [k]: props[k] };
  }

  // Text-specific
  if (mapped === 'text') {
    if (props.text) node.text = props.text;
    if (props.fontSize !== undefined) node.style.fontSize = props.fontSize;
    if (props.fontWeight !== undefined) node.style.fontWeight = props.fontWeight;
    if (props.lineHeight !== undefined) node.style.lineHeight = props.lineHeight;
    if (props.letterSpacing !== undefined) node.style.letterSpacing = props.letterSpacing;
    if (props.fill !== undefined) node.style.color = props.fill;
    const textContent = (astNode.children || [])
      .filter(c => c.type === 'Text')
      .map(c => c.value)
      .join(' ')
      .trim();
    if (textContent) node.text = textContent;
  }

  // Image / vector
  if (mapped === 'image' || mapped === 'vector') {
    if (props.src) node.src = props.src;
  }

  // Children
  node.children = (astNode.children || []).map(mapNode);
  return node;
}

export async function transformJsx(source, options = {}) {
  const ast = parseJsx(source);
  const root = mapNode(ast);
  const ir = {
    name: options.name || (root.name || 'Component'),
    root,
    bridges: [],
  };
  if (options.nodeId) ir.nodeId = options.nodeId;
  if (options.tokens) ir.tokens = options.tokens;

  if (root.width !== undefined) ir.width = root.width;
  if (root.height !== undefined) ir.height = root.height;

  const validate = await loadValidator();
  if (!validate(ir)) {
    const err = validate.errors[0];
    const path = err.instancePath || '(root)';
    throw new Error(`IR validation failed at ${path}: ${err.message}`);
  }
  return ir;
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `node --test figma-to-react/tests/transform.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add figma-to-react/scripts/transform.mjs figma-to-react/tests/transform.test.mjs figma-to-react/package-lock.json
git commit -m "feat(figma-to-react): add JSX → IR transform with ajv validation"
```

---

## Task 8: Token parser

**Files:**
- Create: `figma-to-react/scripts/tokens.mjs`
- Create: `figma-to-react/tests/tokens.test.mjs`

**Interfaces:**
- Consumes: CSS source string (as produced by `figma-cli export css`)
- Produces: a Map<string,string> from token name to fallback value. Pure function.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/tokens.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/tokens.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/tokens.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/tokens.mjs`**

```javascript
// Parse a CSS file containing :root { --token: value; ... } into a Map.
const BLOCK_RE = /:root\s*\{([\s\S]*?)\}/g;
const DECL_RE = /--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;

export function parseTokensCss(css) {
  const out = new Map();
  if (typeof css !== 'string' || css.length === 0) return out;
  for (const block of css.matchAll(BLOCK_RE)) {
    const body = block[1];
    for (const decl of body.matchAll(DECL_RE)) {
      const name = `--${decl[1]}`;
      const value = decl[2].trim();
      out.set(name, value);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/tokens.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/tokens.mjs figma-to-react/tests/tokens.test.mjs
git commit -m "feat(figma-to-react): add tokens.css parser"
```

---

## Task 9: `render-react.mjs` (IR → React JSX string)

**Files:**
- Create: `figma-to-react/scripts/render-react.mjs`
- Create: `figma-to-react/tests/render-react.test.mjs`

**Interfaces:**
- Consumes: IR object (matching `ir.schema.json`), token map (from `parseTokensCss`)
- Produces: a string of valid React JSX source. Pure function. The output, when wrapped with a default-export `function <Name>() { return (...) }`, is a directly-usable React component.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/render-react.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/render-react.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/render-react.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/render-react.mjs`**

```javascript
// Render an IR object into a React component source string (inline style only).
const INDENT = '  ';

function jsString(v) {
  if (v === null || v === undefined) return 'undefined';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(String(v));
}

function toCssValue(v) {
  if (typeof v === 'number') return `'${v}px'`;
  if (typeof v === 'string' && v.startsWith('__token:')) {
    const tokenName = '--' + v.slice('__token:'.length);
    return `'var(${tokenName}, CURRENT_FALLBACK)'`; // caller replaces CURRENT_FALLBACK
  }
  return jsString(v);
}

function resolveTokenValue(v, tokens) {
  if (typeof v === 'string' && v.startsWith('__token:')) {
    const tokenName = '--' + v.slice('__token:'.length);
    return tokens.get(tokenName) || '';
  }
  return v;
}

function styleEntriesFor(node, tokens) {
  const out = [];
  const style = node.style || {};

  // Map IR style fields → CSS properties.
  if ('fill' in style) {
    const v = resolveTokenValue(style.fill, tokens);
    out.push(['background', v]);
  }
  if ('stroke' in style) {
    const v = resolveTokenValue(style.stroke, tokens);
    const weight = style.strokeWidth !== undefined ? Number(style.strokeWidth) : 1;
    out.push(['border', `'${weight}px solid ${v}'`]);
  }
  if ('cornerRadius' in style) {
    out.push(['borderRadius', `'${style.cornerRadius}px'`]);
  }
  if ('opacity' in style) {
    out.push(['opacity', String(style.opacity)]);
  }
  if ('fontSize' in style) {
    out.push(['fontSize', toCssValue(style.fontSize)]);
  }
  if ('fontWeight' in style) {
    out.push(['fontWeight', jsString(style.fontWeight)]);
  }
  if ('lineHeight' in style) {
    out.push(['lineHeight', toCssValue(style.lineHeight)]);
  }
  if ('letterSpacing' in style) {
    out.push(['letterSpacing', toCssValue(style.letterSpacing)]);
  }
  if ('color' in style) {
    const v = resolveTokenValue(style.color, tokens);
    out.push(['color', v]);
  }
  return out;
}

function buildInlineStyle(node, tokens) {
  const entries = [];
  // Layout (frame-specific)
  if (node.type === 'frame' && node.layoutMode && node.layoutMode !== 'none') {
    entries.push(['display', "'flex'"]);
    entries.push(['flexDirection', node.layoutMode === 'vertical' ? "'column'" : "'row'"]);
    if (node.gap !== undefined) entries.push(['gap', `'${node.gap}px'`]);
    if (node.padding) {
      const p = node.padding;
      const sameH = p.left === p.right;
      const sameV = p.top === p.bottom;
      if (sameH && sameV) {
        entries.push(['padding', `'${p.top}px ${p.right}px'`]);
      } else {
        entries.push(['padding', `'${p.top}px ${p.right}px ${p.bottom}px ${p.left}px'`]);
      }
    }
    if (node.primaryAxisAlignItems) {
      const map = { MIN: "'flex-start'", CENTER: "'center'", MAX: "'flex-end'", SPACE_BETWEEN: "'space-between'" };
      entries.push(['justifyContent', map[node.primaryAxisAlignItems] || jsString(node.primaryAxisAlignItems)]);
    }
    if (node.counterAxisAlignItems) {
      const map = { MIN: "'flex-start'", CENTER: "'center'", MAX: "'flex-end'" };
      entries.push(['alignItems', map[node.counterAxisAlignItems] || jsString(node.counterAxisAlignItems)]);
    }
  }
  if (node.type === 'frame' && (!node.layoutMode || node.layoutMode === 'none')) {
    entries.push(['position', "'relative'"]);
  }
  // Geometry for non-auto-layout children: absolute positioning.
  if (node.type !== 'frame' && (node.x !== undefined || node.y !== undefined)) {
    entries.push(['position', "'absolute'"]);
    if (node.x !== undefined) entries.push(['left', `'${node.x}px'`]);
    if (node.y !== undefined) entries.push(['top', `'${node.y}px'`]);
  }
  if (node.type === 'rectangle' || node.type === 'ellipse' || node.type === 'vector' || node.type === 'image') {
    if (node.width !== undefined) entries.push(['width', `'${node.width}px'`]);
    if (node.height !== undefined) entries.push(['height', `'${node.height}px'`]);
    if (node.type === 'ellipse') entries.push(['borderRadius', "'50%'"]);
  }
  if (node.type === 'image') entries.push(['objectFit', "'contain'"]);

  // Visual style from IR.style
  for (const [k, v] of styleEntriesFor(node, tokens)) {
    entries.push([k, typeof v === 'string' && v.startsWith("'") ? v : jsString(v)]);
  }

  if (entries.length === 0) return null;
  return '{ ' + entries.map(([k, v]) => `${k}: ${v}`).join(', ') + ' }';
}

function renderNode(node, tokens, depth) {
  const pad = INDENT.repeat(depth);
  const style = buildInlineStyle(node, tokens);
  const styleAttr = style ? ` style={${style}}` : '';

  if (node.type === 'text') {
    return `${pad}<span${styleAttr}>${escapeJsxText(node.text || '')}</span>`;
  }
  if (node.type === 'image') {
    return `${pad}<img${styleAttr} src={${jsString(node.src || '')}} alt="" />`;
  }
  if (node.type === 'vector') {
    // Best effort: emit an <img> placeholder pointing to a flattened asset path.
    return `${pad}<img${styleAttr} src={${jsString(node.src || 'about:blank')}} alt="" data-figma-bridge="flattened" />`;
  }
  if (!node.children || node.children.length === 0) {
    return `${pad}<div${styleAttr} />`;
  }
  const childPad = INDENT.repeat(depth + 1);
  const inner = node.children.map(c => renderNode(c, tokens, depth + 1)).join('\n');
  return `${pad}<div${styleAttr}>\n${inner}\n${pad}</div>`;
}

function escapeJsxText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pascalCase(name) {
  const parts = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') || 'Component';
}

export function renderReactComponent(ir, tokens) {
  const compName = pascalCase(ir.name);
  const tree = renderNode(ir.root, tokens, 3);
  return `import React from 'react';\n\nexport default function ${compName}() {\n  return (\n${tree}\n  );\n}\n`;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/render-react.test.mjs`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/render-react.mjs figma-to-react/tests/render-react.test.mjs
git commit -m "feat(figma-to-react): add IR → React component renderer"
```

---

## Task 10: `bridges.mjs` (write `.figma-bridges.json`)

**Files:**
- Create: `figma-to-react/scripts/bridges.mjs`
- Create: `figma-to-react/tests/bridges.test.mjs`

**Interfaces:**
- Consumes: IR object
- Produces: bridges object shaped `{ component: string, bridges: [...] }`. Pure function. No filesystem writes from this module — caller persists.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/bridges.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/bridges.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/bridges.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/bridges.mjs`**

```javascript
// Walk an IR tree and collect degradation records.
export function collectBridges(ir) {
  const bridges = [];
  walk(ir.root, ir, bridges);
  return { component: ir.name, nodeId: ir.nodeId, bridges };
}

function walk(node, ir, bridges) {
  if (node.type === 'vector') {
    bridges.push({
      nodeId: node.name || '(unnamed)',
      kind: 'flattened',
      reason: 'vector path flattened to <img>; complex SVG path not auto-converted',
    });
  }
  if (node.type === 'text' && node.style && node.style.fontFamily) {
    bridges.push({
      nodeId: node.name || '(unnamed)',
      kind: 'font-missing',
      reason: `fontFamily=${node.style.fontFamily} must be loaded as a web font in the consuming project`,
    });
  }
  if (node.type === 'text' && node.style && node.style.lineHeight === undefined) {
    bridges.push({
      nodeId: node.name || '(unnamed)',
      kind: 'needs-rewrite',
      reason: 'text has no lineHeight; visual line wrapping may differ from Figma',
    });
  }
  for (const c of node.children || []) walk(c, ir, bridges);
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/bridges.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/bridges.mjs figma-to-react/tests/bridges.test.mjs
git commit -m "feat(figma-to-react): add bridges collector"
```

---

## Task 11: `templates/preview.html.mjs`

**Files:**
- Create: `figma-to-react/templates/preview.html.mjs`

**Interfaces:**
- Consumes: list of component names (strings)
- Produces: HTML string. Pure function. The HTML uses import map for `react` and `react-dom/client`, includes one `<section data-component="...">` per component, and loads `preview.js`.

- [ ] **Step 1: Write the file**

Create `figma-to-react/templates/preview.html.mjs`:

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
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18",
      "react-dom/client": "https://esm.sh/react-dom@18/client"
    }
  }
  </script>
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

- [ ] **Step 2: Commit**

```bash
git add figma-to-react/templates/preview.html.mjs
git commit -m "feat(figma-to-react): add unified preview HTML template"
```

---

## Task 12: `build-preview.mjs` (esbuild + page assembly)

**Files:**
- Create: `figma-to-react/scripts/build-preview.mjs`
- Create: `figma-to-react/tests/build-preview.test.mjs`

**Interfaces:**
- Consumes: filesystem layout under `dist/<Name>/<Name>.jsx` and a tokens.css path; output directory `preview/`. Pure I/O. Side effect: writes `dist-esm/`, `preview/index.html`, `preview/preview.js`.
- Produces: a summary `{ components: string[], outputDir: string }`.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/build-preview.test.mjs`**

This test uses a temporary `dist/` tree created with `fs.mkdtemp` and `fs.writeFile`. It then runs `buildPreview` and asserts file contents.

```javascript
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
  assert.match(html, /importmap/);
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/build-preview.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/build-preview.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/build-preview.mjs`**

```javascript
// Build the unified preview page: compile each dist/<Name>/<Name>.jsx via esbuild,
// emit dist-esm/<Name>/<Name>.js, then write preview/index.html + preview/preview.js.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as esbuild from 'esbuild';
import { renderPreviewHtml } from '../templates/preview.html.mjs';

export async function buildPreview({ workdir }) {
  const distDir = join(workdir, 'dist');
  const distEsmDir = join(workdir, 'dist-esm');
  const previewDir = join(workdir, 'preview');

  const entries = await readdir(distDir, { withFileTypes: true });
  const componentDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  if (componentDirs.length === 0) {
    throw new Error('No components found under ' + distDir);
  }

  await mkdir(distEsmDir, { recursive: true });
  await mkdir(previewDir, { recursive: true });

  // Compile each component JSX → ESM.
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

  // Write preview/index.html.
  await writeFile(join(previewDir, 'index.html'), renderPreviewHtml(componentDirs), 'utf8');

  // Write preview/preview.js — dynamic import of each compiled component, mount to its section.
  const importLines = componentDirs.map(n => `import ${n} from '../dist-esm/${n}/${n}.js';`).join('\n');
  const mapEntries = componentDirs.map(n => `  ${n}: document.getElementById('mount-${n}')`).join(',\n');
  const renderLines = componentDirs.map(n =>
    `  const mount = mounts.${n};\n  if (mount) createRoot(mount).render(React.createElement(${n}));`
  ).join('\n');

  const previewJs = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${importLines}\n\nconst mounts = {\n${mapEntries}\n};\n\n${renderLines}\n`;
  await writeFile(join(previewDir, 'preview.js'), previewJs, 'utf8');

  return { components: componentDirs, outputDir: previewDir };
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/build-preview.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/build-preview.mjs figma-to-react/tests/build-preview.test.mjs
git commit -m "feat(figma-to-react): add unified preview build (esbuild + html + entry)"
```

---

## Task 13: `resolve-input.mjs` (URL parsing + nodeId routing)

**Files:**
- Create: `figma-to-react/scripts/resolve-input.mjs`
- Create: `figma-to-react/tests/resolve-input.test.mjs`

**Interfaces:**
- Consumes: `flags` object `{ url?, fileKey?, node?, fromFind?, selection? }`
- Produces: `{ mode: 'daemon' | 'pat' | 'mock', nodeIds: string[] }`. Pure function for URL/fileKey parsing; subprocess calls for the daemon/PAT detection and `find` are wrapped behind a `runner` parameter (default uses `figma-cli`).

- [ ] **Step 1: Write the failing test `figma-to-react/tests/resolve-input.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInput } from '../scripts/resolve-input.mjs';

// A runner that pretends daemon is up and find returns two ids.
const daemonRunner = {
  async run(_args) {
    if (_args[0] === 'status') return { stdout: 'daemon-running\n' };
    if (_args[0] === 'config') return { stdout: 'token=***\n' };
    if (_args[0] === 'find') return { stdout: JSON.stringify([{ id: '1:1' }, { id: '1:2' }]) };
    return { stdout: '' };
  },
};
const noDaemonRunner = {
  async run(_args) {
    if (_args[0] === 'status') return { stdout: 'daemon-stopped\n' };
    if (_args[0] === 'config') return { stdout: 'token=***\n' };
    if (_args[0] === 'find') return { stdout: JSON.stringify([{ id: '2:5' }]) };
    return { stdout: '' };
  },
};

test('resolveInput parses --url into fileKey + nodeId and uses daemon mode', async () => {
  const r = await resolveInput(
    { url: 'https://www.figma.com/file/ABC123/MyFile?node-id=1-23' },
    { runner: daemonRunner }
  );
  assert.equal(r.mode, 'daemon');
  assert.deepEqual(r.nodeIds, ['1:23']);
});

test('resolveInput rejects --url without node-id', async () => {
  await assert.rejects(
    () => resolveInput({ url: 'https://www.figma.com/file/ABC123/MyFile' }, { runner: daemonRunner }),
    /URL must include a node-id parameter/
  );
});

test('resolveInput uses --file-key + --node directly', async () => {
  const r = await resolveInput(
    { fileKey: 'XYZ', node: '4:5' },
    { runner: daemonRunner }
  );
  assert.deepEqual(r.nodeIds, ['4:5']);
});

test('resolveInput expands --from-find into multiple NodeIds', async () => {
  const r = await resolveInput({ fromFind: 'Button' }, { runner: daemonRunner });
  assert.equal(r.mode, 'daemon');
  assert.deepEqual(r.nodeIds, ['1:1', '1:2']);
});

test('resolveInput falls back to PAT mode when daemon is down', async () => {
  const r = await resolveInput({ fromFind: 'X' }, { runner: noDaemonRunner });
  assert.equal(r.mode, 'pat');
  assert.deepEqual(r.nodeIds, ['2:5']);
});

test('resolveInput throws when both daemon and token are unavailable', async () => {
  const emptyRunner = { async run() { return { stdout: '' }; } };
  await assert.rejects(
    () => resolveInput({ fromFind: 'X' }, { runner: emptyRunner }),
    /figma-cli connect|set-token/
  );
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/resolve-input.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/resolve-input.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/resolve-input.mjs`**

```javascript
// Resolve user-supplied input flags into a final list of NodeIds + execution mode.
import { spawn } from 'node:child_process';

const FIGMA_URL_RE = /^https?:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([A-Za-z0-9]+)\/[^?]*\?(?:[^#]*&)?node-id=([0-9]+-[0-9]+)/;

function nodeIdFromUrl(url) {
  const m = FIGMA_URL_RE.exec(url);
  if (!m) return null;
  return m[2].replace('-', ':');
}

function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('figma-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

export async function resolveInput(flags, { runner = defaultRunner } = {}) {
  // 1. Detect mode.
  const status = await runner(['status']);
  const daemonUp = /daemon-running|connected-to-figma/i.test(status.stdout);
  const config = await runner(['config']);
  const hasToken = /token=\S+/i.test(config.stdout);
  const mode = daemonUp ? 'daemon' : (hasToken ? 'pat' : null);
  if (!mode) {
    throw new Error('figma-cli is not connected. Run `figma-cli connect` or `figma-cli config set-token <TOKEN>`.');
  }

  // 2. Translate flags → NodeId list.
  if (flags.url) {
    const id = nodeIdFromUrl(flags.url);
    if (!id) {
      throw new Error('URL must include a node-id parameter, or use --from-find <name> instead.');
    }
    return { mode, nodeIds: [id] };
  }
  if (flags.fileKey && flags.node) {
    return { mode, nodeIds: [flags.node] };
  }
  if (flags.fromFind) {
    const result = await runner(['find', flags.fromFind]);
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { parsed = []; }
    const ids = Array.isArray(parsed) ? parsed.map(x => x && x.id).filter(Boolean) : [];
    if (ids.length === 0) {
      throw new Error(`figma-cli find "${flags.fromFind}" returned no matches.`);
    }
    return { mode, nodeIds: ids };
  }
  if (flags.selection) {
    if (mode !== 'daemon') {
      throw new Error('--selection requires the desktop daemon (PAT mode has no live selection).');
    }
    const result = await runner(['get']);
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { parsed = null; }
    if (!parsed || !parsed.id) {
      throw new Error('No current selection in Figma. Click a node first.');
    }
    return { mode, nodeIds: [parsed.id] };
  }

  throw new Error('No input provided. Use --url, --file-key + --node, --from-find, or --selection.');
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/resolve-input.test.mjs`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/resolve-input.mjs figma-to-react/tests/resolve-input.test.mjs
git commit -m "feat(figma-to-react): add input resolution (URL/file-key/find/selection, daemon+PAT)"
```

---

## Task 14: `extract.mjs` (figma-cli subprocess driver)

**Files:**
- Create: `figma-to-react/scripts/extract.mjs`
- Create: `figma-to-react/tests/extract.test.mjs`

**Interfaces:**
- Consumes: `nodeIds[]`, `mode`, `workdir`, `runner`
- Produces: writes to `workdir/tmp/<id>.jsx`, `workdir/tmp/tokens.css`. Side-effect I/O; subprocess via `runner`. Returns `{ jsxFiles: string[], tokensFile: string }`.

- [ ] **Step 1: Write the failing test `figma-to-react/tests/extract.test.mjs`**

This test uses a stub runner that records calls and writes minimal content for each `export-jsx`.

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extract } from '../scripts/extract.mjs';

const stubRunner = {
  calls: [],
  async run(args) {
    this.calls.push(args);
    if (args[0] === 'export-jsx') {
      return { stdout: `<Frame name="Stub" width={10} height={10} direction="horizontal" />` };
    }
    if (args[0] === 'export') {
      return { stdout: ':root { --color-primary: #000; }' };
    }
    return { stdout: '' };
  },
};

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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `node --test figma-to-react/tests/extract.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/extract.mjs'`.

- [ ] **Step 3: Implement `figma-to-react/scripts/extract.mjs`**

```javascript
// Drive figma-cli to extract per-node JSX and a shared tokens.css.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('figma-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
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

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test figma-to-react/tests/extract.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add figma-to-react/scripts/extract.mjs figma-to-react/tests/extract.test.mjs
git commit -m "feat(figma-to-react): add extract driver (figma-cli export-jsx + export css)"
```

---

## Task 15: `orchestrate.mjs` (end-to-end CLI entry)

**Files:**
- Create: `figma-to-react/scripts/orchestrate.mjs`

**Interfaces:**
- Consumes: `argv` array
- Produces: side effects — writes `dist/`, `dist-esm/`, `preview/`. Prints a final report.
- The CLI is invoked as `figma-to-react --url ...` or `figma-to-react --file-key X --node Y` etc.

- [ ] **Step 1: Write `figma-to-react/scripts/orchestrate.mjs`**

```javascript
#!/usr/bin/env node
// End-to-end entry: resolve input → extract → transform → render → build preview → report.
import { resolveInput } from './resolve-input.mjs';
import { extract } from './extract.mjs';
import { transformJsx } from './transform.mjs';
import { parseTokensCss } from './tokens.mjs';
import { renderReactComponent } from './render-react.mjs';
import { collectBridges } from './bridges.mjs';
import { buildPreview } from './build-preview.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') flags.url = argv[++i];
    else if (a === '--file-key') flags.fileKey = argv[++i];
    else if (a === '--node') flags.node = argv[++i];
    else if (a === '--from-find') flags.fromFind = argv[++i];
    else if (a === '--selection') flags.selection = true;
    else if (a === '--workdir') flags.workdir = argv[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return flags;
}

function printHelp() {
  console.log(`figma-to-react — convert Figma components into React + unified preview

Usage:
  figma-to-react --url <figma-url>
  figma-to-react --file-key <key> --node <id>
  figma-to-react --from-find <name>
  figma-to-react --selection

Options:
  --workdir <dir>    Output directory (default: current directory)
`);
}

function pascalCase(name) {
  const parts = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') || 'Component';
}

function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('figma-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

export async function main(argv = process.argv.slice(2), { runner = defaultRunner } = {}) {
  const flags = parseArgs(argv);
  const workdir = flags.workdir || process.cwd();

  console.log('→ Resolving input...');
  const { mode, nodeIds } = await resolveInput(flags, { runner });
  console.log(`  mode=${mode}, nodeIds=${nodeIds.join(', ')}`);

  console.log('→ Extracting from Figma...');
  const { jsxFiles, tokensFile } = await extract({ nodeIds, mode, workdir, runner });
  const tokens = parseTokensCss(await readFile(tokensFile, 'utf8'));

  console.log('→ Transforming + rendering components...');
  for (const jsxPath of jsxFiles) {
    const source = await readFile(jsxPath, 'utf8');
    const id = basename(jsxPath, '.jsx');
    // Try to infer a friendly name from the IR's root name, fallback to NodeId.
    const ir = await transformJsx(source, { name: id, nodeId: id.replace('-', ':') });
    const compName = pascalCase(ir.root.name || ir.name);
    const code = renderReactComponent({ ...ir, name: compName }, tokens);
    const outDir = join(workdir, 'dist', compName);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${compName}.jsx`), code, 'utf8');
    const bridges = collectBridges({ ...ir, name: compName });
    await writeFile(join(outDir, `${compName}.figma-bridges.json`), JSON.stringify(bridges, null, 2), 'utf8');
    if (tokens.size > 0) {
      const tokensBlock = `:root {\n${[...tokens.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
      await writeFile(join(outDir, 'tokens.css'), tokensBlock, 'utf8');
    }
    console.log(`  • dist/${compName}/${compName}.jsx (bridges: ${bridges.bridges.length})`);
  }

  console.log('→ Building unified preview...');
  const { components, outputDir } = await buildPreview({ workdir });
  console.log(`  • ${outputDir}/index.html`);

  console.log('');
  console.log('Done. To preview:');
  console.log(`  cd "${workdir}" && npx serve .`);
  console.log('  or: cd "' + workdir + '" && python -m http.server 8000');
  console.log('');
  console.log(`Components: ${components.join(', ')}`);
}

const invokedDirectly = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (invokedDirectly) {
  main().catch(err => {
    console.error('figma-to-react failed:', err.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 2: Smoke check (no figma-cli required)**

Run: `node figma-to-react/scripts/orchestrate.mjs --help`
Expected: prints the help text and exits 0.

- [ ] **Step 3: Commit**

```bash
git add figma-to-react/scripts/orchestrate.mjs
git commit -m "feat(figma-to-react): add end-to-end CLI orchestrator"
```

---

## Task 16: Reference docs

**Files:**
- Create: `figma-to-react/references/workflow.md`
- Create: `figma-to-react/references/react-render.md`
- Create: `figma-to-react/references/preview.md`
- Create: `figma-to-react/references/input-modes.md`
- Create: `figma-to-react/references/batch.md`
- Create: `figma-to-react/references/limitations.md`

**Interfaces:** Pure markdown documentation, loaded by `SKILL.md` on demand. No executable code.

- [ ] **Step 1: Create `figma-to-react/references/workflow.md`**

```markdown
# Workflow

6 phases, each independently re-runnable via `--only <phase>`.

1. **resolve-input** — `resolve-input.mjs`. URL / file-key / find / selection → NodeId list + mode.
2. **extract** — `extract.mjs`. `figma-cli export-jsx <id>` per node; `figma-cli export css` once.
3. **transform** — `transform.mjs`. JSX → IR (JSON, schema-validated).
4. **render-react** — `render-react.mjs` + `bridges.mjs`. IR → `dist/<Name>/<Name>.jsx` + `.figma-bridges.json` + optional `tokens.css`.
5. **build-preview** — `build-preview.mjs`. esbuild compiles JSX to `dist-esm/`; emits `preview/index.html` + `preview/preview.js`.
6. **report** — orchestrator prints output list and server command.

Re-running a phase: `figma-to-react --url <url> --only render-react`.

`extract.mjs` is the only module that calls `figma-cli`. The rest are pure functions over JSON.
```

- [ ] **Step 2: Create `figma-to-react/references/react-render.md`**

```markdown
# React Render Mapping

`render-react.mjs` maps IR nodes to JSX with inline `style={{...}}`.

| IR type | Tag | Style properties |
|---|---|---|
| `frame` (layoutMode: horizontal) | `<div>` | `display: flex`, `flexDirection: row`, `gap`, `padding`, `justifyContent`, `alignItems` |
| `frame` (layoutMode: vertical) | `<div>` | `display: flex`, `flexDirection: column`, ... |
| `frame` (layoutMode: none) | `<div>` | `position: relative`; children get `position: absolute` + `left`/`top` |
| `rectangle` | `<div>` | `width`, `height`, `background`, `border` (from stroke), `borderRadius` |
| `ellipse` | `<div>` | `width`, `height`, `background`, `borderRadius: 50%` |
| `text` | `<span>` | `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `color` |
| `image` | `<img>` | `width`, `height`, `objectFit: contain`, `src` |
| `vector` | `<img data-figma-bridge="flattened">` | placeholder, real asset to be supplied by user |
| `group` | `<div>` | no visual style, only nesting |

Rules:
- Numeric CSS values get `'<n>px'` units. Never bare numbers in `style={{...}}`.
- `fill` → `background`; `stroke` + `strokeWidth` → `border: <w>px solid <color>`.
- Text `fill` → `color`.
- Auto-layout is always translated to flexbox; non-auto-layout uses absolute positioning for children.
```

- [ ] **Step 3: Create `figma-to-react/references/preview.md`**

```markdown
# Unified Preview Page

`build-preview.mjs` emits exactly one `preview/index.html` plus a `preview/preview.js` entry, plus per-component ESM bundles under `dist-esm/<Name>/<Name>.js`.

The HTML uses an import map for `react@18` and `react-dom@18/client` from `esm.sh`. The page renders one `<section data-component="...">` per component, each with a `<div id="mount-<Name>">` mount point.

Serving locally:
- `npx serve .`
- `python -m http.server 8000`

Per-component previews are forbidden by spec. A single `index.html` is the only allowed preview surface.
```

- [ ] **Step 4: Create `figma-to-react/references/input-modes.md`**

```markdown
# Input Modes (Daemon + PAT)

`resolve-input.mjs` picks one of two modes by probing `figma-cli`:

1. `daemon` — `figma-cli status` reports daemon running. Used for live work with the desktop app.
2. `pat` — daemon is down but `figma-cli config` has a token. Used for offline / CI use.

If neither is available, the skill aborts with a clear message pointing to `figma-cli connect` or `figma-cli config set-token <TOKEN>`.

Input forms:
- `--url <figma-url>` — URL must contain `node-id=...`. URL with only a file key is rejected.
- `--file-key <key> + --node <id>` — direct.
- `--from-find <name>` — calls `figma-cli find` and uses all matches (batch mode).
- `--selection` — daemon only; reads current Figma selection. Rejected under PAT.
```

- [ ] **Step 5: Create `figma-to-react/references/batch.md`**

```markdown
# Batch Mode

When `--from-find` or repeated `--node` flags produce multiple NodeIds, the skill runs in batch mode:

- One `export-jsx` per NodeId.
- One shared `tokens.css` for the whole batch.
- One `dist/<Name>/` directory per component.
- One unified `preview/index.html` that mounts every component.

A `bridges` summary is printed per component at the end. The orchestrator never aborts the batch on a single component failure unless the failure is a hard error (e.g. `extract` failed); bridges (degradation) entries are non-fatal.
```

- [ ] **Step 6: Create `figma-to-react/references/limitations.md`**

```markdown
# Known Limitations & Bridges

The skill targets "structure + style alignment", not pixel-perfect 1:1. These are the known cases that degrade:

| Case | What happens | Bridge kind |
|---|---|---|
| Vector paths with complex beziers | Rendered as `<img>` placeholder, no inline SVG auto-conversion | `flattened` |
| Figma `fontFamily` not available locally | Inline style emits `fontFamily` verbatim; rendering falls back to system font in browser | `font-missing` |
| Effects: drop shadow / inner shadow / blur | Best-effort: only `box-shadow` for drop shadow; inner shadow and blur dropped | `effect-lossy` |
| Blend modes (e.g. `MULTIPLY`) | Not emitted; element rendered normally | `effect-lossy` |
| Text without `lineHeight` | Wrap behavior may differ | `needs-rewrite` |

Every bridge is recorded in `dist/<Name>/<Name>.figma-bridges.json`. The file is consumed by humans or follow-up AI passes; the skill itself does not auto-fix bridges.
```

- [ ] **Step 7: Commit**

```bash
git add figma-to-react/references/
git commit -m "docs(figma-to-react): add workflow + render + preview + input + batch + limitations"
```

---

## Task 17: `SKILL.md` (routing contract)

**Files:**
- Create: `figma-to-react/SKILL.md`

**Interfaces:** Markdown frontmatter at the top with `name`, `model`, `category`, `description`, `version`. Body contains routing rules, hard constraints, mandatory lookups, and Red Flags. References the spec and plan.

- [ ] **Step 1: Write `figma-to-react/SKILL.md`**

```markdown
---
name: figma-to-react
model: sonnet
category: design
description: Use when converting Figma components into directly-usable React components with a unified preview page, driven by figma-cli. Triggers on "figma to react", "export figma as react", "figma component to jsx".
version: 1.0
---

# figma-to-react

将用户在 Figma 中已建好的组件转换为可直接 `<Component />` 渲染的 React 组件，并生成统一预览页。Skill 设计规格：`docs/superpowers/specs/2026-07-15-figma-to-react-design.md`。

## Authority Invariant

- SKILL.md 是路由合约：概述、强制门禁、必读 reference、命令矩阵、Red Flags。
- 所有执行细节、节点映射、命令、术语表、限制说明仅在 `references/`。每个 Workflow 阶段必须加载对应 reference，禁止用 SKILL.md 替代任何一次加载。
- `scripts/extract.mjs` 是唯一调用 `figma-cli` 的模块；其余模块均为纯函数，对 fixture 可测。
- `schemas/ir.schema.json` 是 IR 唯一事实来源；`scripts/transform.mjs` 与 `scripts/render-react.mjs` 必须用 ajv 校验。

## Non-Negotiable Rules

- 所有 Figma 读取必须通过 `figma-cli`，禁止使用 Figma MCP、Figma REST API、GUI 自动化、eval/run 等替代路径。
- 每个新会话首次执行前必须按顺序运行 `figma-cli --version`、`figma-cli --help`、`figma-cli status`；未连接时按 `references/input-modes.md` 路由 daemon / PAT。
- 唯一输出形态是 React 组件 + 统一预览页。禁止输出 Vue / Svelte / Solid；禁止单组件独立预览文件。
- React 组件必须使用 inline `style={{...}}`，禁止生成额外 CSS 文件（tokens.css 例外，仅用于 CSS 变量定义）。
- 数值 CSS 值必须带 `px` 单位出现在 inline style 中；禁止裸数字。
- Figma Variables 走 `figma-cli export css`，渲染为 `var(--token-name, #fallback)` 形式；禁止只输出硬编码回退值。
- 复杂原语（vector path、mask、blend mode、effect blur）走"最大努力 CSS/SVG 重现，不能重现就拍平为 `<img>`"，并写入 `.figma-bridges.json`，**禁止**阻断主流程。
- 浏览器原生 ESM 不支持 JSX；`build-preview.mjs` 必须用 esbuild 预编译 `dist/*/*.jsx` 为 `dist-esm/*/*.js`，**禁止**在浏览器内运行 babel/JSX 转换。
- `--url` 形态若 URL 里不含 `node-id` 参数（仅 file 级别），必须报错并提示使用 `--from-find <name>`，**禁止**默认从 file 根节点开始转换。
- 所有硬性要求必须用"必须""禁止""只有……才允许"措辞；禁止用弱措辞稀释门禁。

## Mandatory Lookups

```text
Workflow 0/1 (输入解析)              → references/input-modes.md
Workflow 2 (extract)                 → references/workflow.md
Workflow 3/4 (transform + render)    → references/react-render.md
Workflow 5 (preview)                 → references/preview.md
批量模式                             → references/batch.md
任何阶段 (1:1 不可达项 / 降级)      → references/limitations.md
```

禁止：用 SKILL.md 替代以上任何一次加载。

## CLI Contract

```bash
figma-to-react --url <figma-url> [--workdir <dir>]
figma-to-react --file-key <key> --node <id> [--workdir <dir>]
figma-to-react --from-find <name> [--workdir <dir>]
figma-to-react --selection [--workdir <dir>]
```

必选其一。`--workdir` 默认 `process.cwd()`。

## Red Flags

- "export-jsx 输出就是 JSX，应该直接能跑" → 错；必须经 `render-react.mjs` 改 inline style、加 px、映射 Figma 元素名为 HTML 标签。
- "Figma 字体一定能用" → 错；本地没装的字体走 bridges 提示，**禁止**静默替换。
- "复杂矢量一定能转 SVG" → 错；不能解析时拍平为 `<img>`，**禁止**抛错阻断。
- "预览页可以每组件一个" → 错；禁止单组件独立预览，必须统一一个 `preview/index.html`。
- "可以直接用 Figma REST API，不依赖 figma-cli" → 错；本技能与 `figma-skill` 对齐，唯一 Figma 入口是 `figma-cli`。
- "可以输出 Vue" → 错；首版明确不做 Vue。
```

- [ ] **Step 2: Verify frontmatter is the first content**

Run: `head -10 figma-to-react/SKILL.md`
Expected: first line is `---`, followed by `name: figma-to-react`, etc.

- [ ] **Step 3: Commit**

```bash
git add figma-to-react/SKILL.md
git commit -m "docs(figma-to-react): add SKILL.md routing contract"
```

---

## Task 18: End-to-end smoke test with a local fixture

**Files:**
- Create: `figma-to-react/tests/e2e.test.mjs`

**Interfaces:** End-to-end test that bypasses `figma-cli` by injecting a stub `runner`, runs the orchestrator against a temp `workdir`, and asserts the expected file tree.

- [ ] **Step 1: Write `figma-to-react/tests/e2e.test.mjs`**

```javascript
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
```

- [ ] **Step 2: Run the test**

Run: `node --test figma-to-react/tests/e2e.test.mjs`
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add figma-to-react/tests/e2e.test.mjs
git commit -m "test(figma-to-react): add e2e smoke test with stubbed figma-cli runner"
```

---

## Task 19: Run the full test suite and verify zero failures

**Files:** None (verification task).

- [ ] **Step 1: Run all tests**

Run: `cd figma-to-react && npm test 2>&1`
Expected: every `*.test.mjs` passes, no failures. Total expected tests: 4 (jsx-parser) + 4 (transform) + 2 (tokens) + 6 (render-react) + 3 (bridges) + 3 (build-preview) + 6 (resolve-input) + 2 (extract) + 1 (e2e) = 31 tests.

- [ ] **Step 2: Verify the directory matches the spec**

Run: `ls figma-to-react/scripts/ figma-to-react/references/ figma-to-react/schemas/ figma-to-react/templates/ figma-to-react/tests/`
Expected: matches the spec's §3 directory tree (no missing files, no extra files except `node_modules/` and `package-lock.json`).

- [ ] **Step 3: Final commit (only if any cleanup is needed)**

```bash
git status
# If clean, no commit needed. Otherwise:
# git add -A && git commit -m "chore(figma-to-react): final cleanup"
```

---

## Self-Review

### 1. Spec coverage

| Spec section | Covered by |
|---|---|
| §1.1 背景 | SKILL.md intro (Task 17) |
| §1.2 目标 — React 组件 | Task 9 (`render-react.mjs`) |
| §1.2 目标 — 统一预览页 | Task 12 (`build-preview.mjs`) |
| §1.2 目标 — bridges.json | Task 10 (`bridges.mjs`) |
| §1.3 非目标 | SKILL.md Red Flags (Task 17) |
| §2 决策 1 (技能名) | package.json (Task 1), SKILL.md (Task 17) |
| §2 决策 2 (figma-cli only) | SKILL.md (Task 17), extract.mjs (Task 14) |
| §2 决策 3 (双模式) | Task 13 (`resolve-input.mjs`) |
| §2 决策 4 (四种输入) | Task 13 |
| §2 决策 5 (统一目录) | Task 15 (`orchestrate.mjs`) |
| §2 决策 6 (禁止单组件预览) | SKILL.md (Task 17), build-preview.mjs (Task 12) |
| §2 决策 7 (inline style) | Task 9 + SKILL.md (Task 17) |
| §2 决策 8 (var() 回退) | Task 9 + Task 8 (tokens) |
| §2 决策 9 (复杂原语 + bridges 不阻断) | Task 9, Task 10, SKILL.md (Task 17) |
| §2 决策 10 (esbuild + devDep 声明) | Task 1 (package.json) + Task 12 (build-preview) + SKILL.md (Task 17) |
| §2 决策 11 (强制措辞) | SKILL.md (Task 17) + references (Task 16) |
| §2 决策 12 (--url 必须含 node-id) | Task 13 test + SKILL.md (Task 17) |
| §3 目录结构 | Tasks 1–17 |
| §4 状态机 | Task 15 + Task 16 (workflow.md) |
| §4.1 resolve-input | Task 13 |
| §4.2 extract | Task 14 |
| §4.3 transform | Task 7 |
| §4.4 render-react | Task 9 |
| §4.5 build-preview | Task 12 |
| §4.6 报告 | Task 15 (orchestrate) |
| §5 模块契约 | Tasks 7, 8, 9, 10, 12, 13, 14, 15 |
| §6 IR schema | Task 2 |
| §7 节点类型映射 | Task 9 + references/react-render.md (Task 16) |
| §8 错误处理 | Tasks 7, 12, 13, 14; references/limitations.md (Task 16) |
| §9 测试 | Tasks 6, 7, 8, 9, 10, 12, 13, 14, 18 |
| §10 Red Flags | SKILL.md (Task 17) |
| §11 与 figma-skill 关系 | SKILL.md (Task 17); no shared state — verified by separate `.figma/` boundary |

**Gaps found and fixed in plan:** none. Every spec requirement has a task.

### 2. Placeholder scan

- No "TBD" / "TODO" / "implement later" / "fill in details" strings in any task body.
- No "add appropriate error handling" — error handling is in the actual code blocks (e.g. Task 14's `extract` throws with stderr/stdout context).
- No "similar to Task N" — every code block is full.
- Every type and function referenced in a later task is defined in an earlier one (`parseJsx` defined in Task 6, consumed by Task 7; `parseTokensCss` defined in Task 8, consumed by Task 9; `transformJsx`, `renderReactComponent`, `collectBridges` defined before Task 15; `buildPreview` defined in Task 12 before Task 15 imports it).

### 3. Type consistency

- `transformJsx(source, options)` — Task 7 definition, Tasks 9, 10, 18, 15 use it. Signature is consistent.
- `renderReactComponent(ir, tokens)` — Task 9 definition, Task 15 imports with same name and signature.
- `collectBridges(ir)` — Task 10 definition, Task 15 imports.
- `buildPreview({ workdir })` — Task 12 definition, Task 15 imports.
- `extract({ nodeIds, mode, workdir, runner })` — Task 14 definition, Task 15 imports.
- `parseTokensCss(css)` — Task 8 definition, Tasks 9, 15 use it.
- `resolveInput(flags, { runner })` — Task 13 definition, Task 15 imports.

All function names match across tasks. ✅
