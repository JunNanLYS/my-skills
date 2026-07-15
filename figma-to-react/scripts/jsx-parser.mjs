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
    TAG_RE.lastIndex = 0;
    CLOSE_TAG_RE.lastIndex = 0;
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
      let closeEnd = -1;
      let closeStart = -1;
      while (depth > 0) {
        const next = CLOSE_TAG_RE.exec(source);
        if (!next) break;
        if (next[0].toLowerCase() === '</' + tag.toLowerCase() + '>') {
          depth -= 1;
          if (depth === 0) {
            closeStart = next.index;
            closeEnd = closeStart + next[0].length;
            break;
          }
        } else {
          // Nested open tag of the same name?
          const openMatch = TAG_RE.exec(source.slice(next.index));
          if (openMatch && openMatch[0].startsWith('<' + tag) && !openMatch[0].endsWith('/>')) {
            depth += 1;
          }
        }
      }
      if (closeStart === -1) {
        throw new Error(`Unclosed <${tag}> at offset ${openIndex}`);
      }
      if (closeStart > cursor) {
        const inner = source.slice(cursor, closeStart);
        // Recursively tokenize the inner content
        const innerTokens = tokenize(inner);
        tokens.push(...innerTokens);
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