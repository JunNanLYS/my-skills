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

function findTagAt(source, pos) {
  // Return the next open or close tag that starts exactly at 'pos', or null.
  // Uses indexOf to locate tags at the given position, avoiding lastIndex issues.
  if (pos >= source.length) return null;
  if (source[pos] !== '<') return null;
  if (source[pos + 1] === '/') {
    const m = CLOSE_TAG_RE.exec(source.slice(pos));
    if (m && m.index === 0) {
      return { type: 'close', tag: m[1], length: m[0].length };
    }
  } else {
    const m = TAG_RE.exec(source.slice(pos));
    if (m && m.index === 0) {
      return { type: 'open', tag: m[1], length: m[0].length,
               attrString: m[2], isSelfClosing: m[0].endsWith('/>') };
    }
  }
  return null;
}

function findNextTag(source, pos) {
  // Return the earliest open or close tag at or after 'pos'.
  // Finds all tags in the remaining substring and picks the one with the smallest index.
  let earliestPos = Infinity;
  let earliestTag = null;

  for (const m of source.slice(pos).matchAll(/<(\/?)([A-Z][A-Za-z0-9]*)\b([^>]*?)(\/?)>/g)) {
    const tagPos = pos + m.index;
    if (tagPos < earliestPos) {
      earliestPos = tagPos;
      if (m[1] === '/') {
        earliestTag = { type: 'close', tag: m[2], length: m[0].length, index: tagPos };
      } else {
        earliestTag = { type: 'open', tag: m[2], length: m[0].length,
                       attrString: m[3], isSelfClosing: m[4] === '/', index: tagPos };
      }
    }
  }
  return earliestTag || null;
}

function tokenize(source) {
  // Returns an ordered list of tokens: open tags, close tags, and text.
  const tokens = [];
  let cursor = 0;

  while (cursor < source.length) {
    // Find the next tag at or after cursor.
    const nextTag = findNextTag(source, cursor);
    if (!nextTag) {
      const rest = source.slice(cursor);
      if (rest.trim().length > 0) {
        tokens.push({ type: 'text', value: rest });
      }
      break;
    }

    // Text between cursor and the next tag.
    if (nextTag.index > cursor) {
      const between = source.slice(cursor, nextTag.index);
      if (between.trim().length > 0) {
        tokens.push({ type: 'text', value: between });
      }
    }

    cursor = nextTag.index;

    if (nextTag.type === 'open') {
      const openIndex = cursor;
      const openLength = nextTag.length;
      tokens.push({ type: 'open', tag: nextTag.tag,
                    props: parseProps(nextTag.attrString),
                    selfClosing: nextTag.isSelfClosing });

      if (!nextTag.isSelfClosing) {
        // Scan forward to find the matching close tag, counting ALL open/close nesting.
        let scanCursor = openIndex + openLength;
        let closeStart = -1;
        let closeEnd = -1;
        let innerDepth = 1;

        while (innerDepth > 0) {
          const innerTag = findNextTag(source, scanCursor);
          if (!innerTag) break;

          if (innerTag.type === 'close') {
            scanCursor = innerTag.index + innerTag.length;
            if (innerDepth === 1) {
              // Found the matching close tag for this element.
              closeStart = innerTag.index;
              closeEnd = scanCursor;
            }
            innerDepth -= 1;
          } else {
            // Open tag (possibly self-closing).
            if (!innerTag.isSelfClosing) {
              innerDepth += 1;
            }
            scanCursor = innerTag.index + innerTag.length;
          }
        }

        if (closeStart === -1) {
          throw new Error(`Unclosed <${nextTag.tag}> at offset ${openIndex}`);
        }

        // Recursively tokenize the inner content between the open and close tags.
        const inner = source.slice(openIndex + openLength, closeStart);
        const innerTokens = tokenize(inner);
        tokens.push(...innerTokens);

        tokens.push({ type: 'close', tag: nextTag.tag });
        cursor = closeEnd;
      } else {
        cursor = openIndex + openLength;
      }
    } else {
      // nextTag.type === 'close'
      if (depth > 0) {
        tokens.push({ type: 'close', tag: nextTag.tag });
        depth -= 1;
      }
      cursor = nextTag.index + nextTag.length;
    }
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
