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
    if (typeof style.fill === 'string' && style.fill.startsWith('__token:')) {
      const tokenName = '--' + style.fill.slice('__token:'.length);
      const fallback = tokens.get(tokenName) || '';
      out.push(['background', `'var(${tokenName}, ${fallback})'`]);
    } else {
      const v = resolveTokenValue(style.fill, tokens);
      out.push(['background', typeof v === 'string' ? `'${v}'` : v]);
    }
  }
  if ('stroke' in style) {
    if (typeof style.stroke === 'string' && style.stroke.startsWith('__token:')) {
      const tokenName = '--' + style.stroke.slice('__token:'.length);
      const fallback = tokens.get(tokenName) || '';
      out.push(['border', `'${style.strokeWidth !== undefined ? Number(style.strokeWidth) : 1}px solid var(${tokenName}, ${fallback})'`]);
    } else {
      const v = resolveTokenValue(style.stroke, tokens);
      const weight = style.strokeWidth !== undefined ? Number(style.strokeWidth) : 1;
      out.push(['border', `'${weight}px solid ${v}'`]);
    }
  }
  if ('cornerRadius' in style) {
    out.push(['borderRadius', `'${style.cornerRadius}px'`]);
  }
  if ('opacity' in style) {
    out.push(['opacity', String(style.opacity)]);
  }
  if ('fontSize' in style) {
    // React inline style: fontSize is a raw number (no 'px' suffix)
    out.push(['fontSize', Number(style.fontSize)]);
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
    if (typeof style.color === 'string' && style.color.startsWith('__token:')) {
      const tokenName = '--' + style.color.slice('__token:'.length);
      const fallback = tokens.get(tokenName) || '';
      out.push(['color', `'var(${tokenName}, ${fallback})'`]);
    } else {
      const v = resolveTokenValue(style.color, tokens);
      out.push(['color', typeof v === 'string' ? `'${v}'` : v]);
    }
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
      const sameAll = p.top === p.right && p.right === p.bottom && p.bottom === p.left;
      if (sameAll) {
        entries.push(['padding', `'${p.top}px'`]);
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
  return `import React from 'react';

export default function ${compName}() {
  return (
${tree}
  );
}
`;
}
