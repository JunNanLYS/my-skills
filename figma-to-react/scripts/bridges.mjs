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
  // Detect unsupported effects and blend modes (lossy).
  if (node.style) {
    if (Array.isArray(node.style.effects) && node.style.effects.length > 0) {
      for (const effect of node.style.effects) {
        bridges.push({
          nodeId: node.name || '(unnamed)',
          kind: 'effect-lossy',
          reason: `effect ${effect.type} is not auto-rendered; pixel-level ${effect.type.toLowerCase().replace('_', ' ')} omitted`,
        });
      }
    }
    if (node.style.blendMode) {
      bridges.push({
        nodeId: node.name || '(unnamed)',
        kind: 'effect-lossy',
        reason: `blendMode ${node.style.blendMode} is not supported in CSS; element rendered normally`,
      });
    }
  }
  for (const c of node.children || []) walk(c, ir, bridges);
}
