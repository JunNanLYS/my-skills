// figma-helpers/list-children.mjs
//
// 列出 Figma 节点的所有直接子节点 (id / name / type / x / y / width / height / right / bottom)。
//
// 用法 (figma-cli run 不透传 --param, 因此调用前改 PARENT_ID 常量):
//
//   1. 编辑本文件第 18 行 PARENT_ID = '你的 parent node id'
//   2. figma-cli run scripts/figma-helpers/list-children.mjs
//
// 可选: 在 PARENT_ID 下面改 ONLY_TYPE 只过滤特定类型 (e.g. 'FRAME')。

(function () {
  // ===== 在这里改 =====
  const PARENT_ID = '1348:47'; // 10 Components Section
  const ONLY_TYPE = null; // 例如 'FRAME' / 'COMPONENT' / 'TEXT' / null(全部)
  // ====================

  const sec = figma.getNodeById(PARENT_ID);
  if (!sec) throw new Error('list-children: 找不到 parent ' + PARENT_ID);

  const out = [];
  for (const c of sec.children) {
    if (ONLY_TYPE && c.type !== ONLY_TYPE) continue;
    out.push({
      id: c.id,
      name: c.name,
      type: c.type,
      x: c.x,
      y: c.y,
      w: c.width,
      h: c.height,
      right: c.x + c.width,
      bottom: c.y + c.height,
    });
  }
  return JSON.stringify({ parent: PARENT_ID, count: out.length, items: out }, null, 2);
})();
