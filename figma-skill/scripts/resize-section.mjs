// figma-helpers/resize-section.mjs
//
// 基于 children bbox 自动算 Section / Frame 的 min size, 加 padding 调整。
// 用于 Workflow 8 末尾或 Workflow 9, 在批量移动后收缩 Section 实际占用空间。
//
// 用法 (figma-cli run 不透传参数, 调用前改 PARENT_ID / PAD_X / PAD_Y):
//
//   1. 编辑第 14 行的 PARENT_ID / PAD_X / PAD_Y
//   2. figma-cli run scripts/figma-helpers/resize-section.mjs
//
// 默认 pad: 80 x 200px (横向留白 80, 纵向留白 200)。

(function () {
  // ===== 在这里改 =====
  const PARENT_ID = '1348:47';
  const PAD_X = 80;
  const PAD_Y = 200;
  // ====================

  const sec = figma.getNodeById(PARENT_ID);
  if (!sec) throw new Error('resize-section: 找不到 parent ' + PARENT_ID);

  let maxB = 0, maxR = 0;
  for (const c of sec.children) {
    if (c.y + c.height > maxB) maxB = c.y + c.height;
    if (c.x + c.width  > maxR) maxR = c.x + c.width;
  }
  const newH = Math.ceil(maxB + PAD_Y);
  const newW = Math.ceil(maxR + PAD_X);
  const prev = { w: sec.width, h: sec.height };
  const result = { parent: PARENT_ID, previous: prev };
  try {
    sec.resize(newW, newH);
    result.resized = { w: newW, h: newH };
    result.padding = { x: PAD_X, y: PAD_Y };
  } catch (e) {
    result.error = e.message;
    result.attempted = { w: newW, h: newH };
  }
  return JSON.stringify(result, null, 2);
})();
