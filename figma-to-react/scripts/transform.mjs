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
  // ajv 8 does not bundle the draft/2020-12 meta-schema; remove the $schema
  // identifier so ajv does not attempt to fetch it. Local $defs/$ref resolution
  // is unaffected.
  delete schema['$schema'];
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

  // Ensure node.style is initialized for text nodes that may only have font props
  node.style = node.style || {};

  // Text-specific — return early without recursing into children.
  // The parser wraps text content in a {type:'Text', value} child; recursing
  // would double-emit the text node as a phantom child in the IR's children array.
  if (mapped === 'text') {
    if (props.text) node.text = props.text;
    if (props.fontSize !== undefined) node.style.fontSize = props.fontSize;
    if (props.fontWeight !== undefined) node.style.fontWeight = props.fontWeight;
    if (props.lineHeight !== undefined) node.style.lineHeight = props.lineHeight;
    if (props.letterSpacing !== undefined) node.style.letterSpacing = props.letterSpacing;
    if (props.fill !== undefined) node.style.color = props.fill;
    if (props.fontFamily !== undefined) node.style.fontFamily = props.fontFamily;
    const textContent = (astNode.children || [])
      .filter(c => c.type === 'Text')
      .map(c => c.value)
      .join(' ')
      .trim();
    if (textContent) node.text = textContent;
    return node;
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
    name: root.name || options.name || 'Component',
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
