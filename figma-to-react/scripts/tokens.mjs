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
