// figma-helpers/overlap-check.mjs
//
// AABB 相交矩阵: 检查 parent 内所有直接子节点两两之间的 bounding box 相交。
// 0 相交 => 排布通过 Workflow 9 的 Geometry 验证门禁。
//
// 用法 (figma-cli run 不透传参数, 因此调用前改 PARENT_ID; 输出模式改 OUTPUT_MODE):
//
//   1. 编辑第 14 行的 PARENT_ID
//   2. figma-cli run scripts/figma-helpers/overlap-check.mjs
//
// OUTPUT_MODE: 'json' (默认, 机器消费) | 'summary' (人读, 文本行)
// 也可在文件末尾调整 ADD_BOX 决定 summary 是否带 bbox 摘要行。

(function () {
  const PARENT_ID = '1348:47';
  const OUTPUT_MODE = 'json';

  const sec = figma.getNodeById(PARENT_ID);
  if (!sec) throw new Error('overlap-check: 找不到 parent ' + PARENT_ID);

  const items = [];
  for (const c of sec.children) {
    items.push({
      id: c.id,
      name: c.name,
      type: c.type,
      x: c.x, y: c.y,
      w: c.width, h: c.height,
      r: c.x + c.width,
      b: c.y + c.height,
    });
  }
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if ((a.x < b.r) && (b.x < a.r) && (a.y < b.b) && (b.y < a.b)) {
        pairs.push({
          a: a.name + ' (' + a.id + ')',
          aBox: [a.x, a.y, a.r, a.b],
          b: b.name + ' (' + b.id + ')',
          bBox: [b.x, b.y, b.r, b.b],
        });
      }
    }
  }

  if (OUTPUT_MODE === 'summary') {
    if (pairs.length === 0) return 'Total: ' + items.length + ' children, 0 overlap pairs';
    const lines = ['Total: ' + items.length + ' children, ' + pairs.length + ' overlap pairs'];
    for (const ov of pairs) {
      lines.push('--');
      lines.push('A: ' + ov.a);
      lines.push('   box: x=' + ov.aBox[0] + ' y=' + ov.aBox[1] + ' w=' + (ov.aBox[2] - ov.aBox[0]) + ' h=' + (ov.aBox[3] - ov.aBox[1]));
      lines.push('B: ' + ov.b);
      lines.push('   box: x=' + ov.bBox[0] + ' y=' + ov.bBox[1] + ' w=' + (ov.bBox[2] - ov.bBox[0]) + ' h=' + (ov.bBox[3] - ov.bBox[1]));
    }
    return lines.join('\n');
  }
  return JSON.stringify({ total: items.length, overlapPairs: pairs.length, overlaps: pairs }, null, 2);
})();
