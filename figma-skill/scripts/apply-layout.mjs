// figma-helpers/apply-layout.mjs
//
// 把移动计划应用到 Figma。计划是 { id, x, y }[] 形式。
//
// 用法:
//
//   # 模式 A: 直接嵌入 (短 plan)
//   figma-cli eval --file scripts/figma-helpers/apply-layout.mjs
//   (需要在 PLANS 数组里直接编辑节点 id / x / y)
//
//   # 模式 B: 通过 stdin JSON (适合中等 plan)
//   figma-cli eval "$(cat scripts/figma-helpers/apply-layout.mjs)\nconst PLANS = $(cat plan.json); ..."
//   (这里直接修改本文件 PLANS 数组, 然后 run)
//
// 注: figma-cli run / eval 都不透传 stdin, 因此本脚本固定从头部 PLANS 数组读取。
//     对于超长 plan (>30 节点), 拆成多批分别 run, 每批一个文件。

(function () {
  // ===== 在这里改: 每个 [{id, x, y}] =====
  const PLANS = [
    // 例:
    // { id: '127:774', x: 80, y: 140 },
    // { id: '127:775', x: 80, y: 1084 },
  ];
  // ==========================

  if (!Array.isArray(PLANS) || PLANS.length === 0) {
    throw new Error('apply-layout: 顶部 PLANS 数组为空, 请先编辑');
  }

  let applied = 0;
  const errors = [];
  for (const m of PLANS) {
    const n = figma.getNodeById(m.id);
    if (!n) { errors.push('missing: ' + m.id); continue; }
    try {
      n.x = m.x;
      n.y = m.y;
      applied++;
    } catch (e) {
      errors.push(m.id + ': ' + e.message);
    }
  }
  return JSON.stringify({
    planned: PLANS.length,
    applied: applied,
    errors: errors,
  }, null, 2);
})();
