# Geometry Verifier Pipeline (Workflow 9 / 10)

Workflow 9 Geometry 层的可执行管线。七道闸门按顺序运行，任一 FAIL 立即停止验收并回到 Workflow 10。

## Gate 1 — Lint

- 命令: `figma-cli lint --json`
- 作用域: 当前 Page / 文件
- 输出解析: Yolo 风格 `messages` 或 Safe 风格 `issues`；`messages.length === 0 && total === 0` 才算 PASS
- FAIL 条件: 任何消息、警告或 info 命中 in-scope 节点
- 修复: 按 lint 报告逐项改；批量 `--fix` 仅在 lint 报告明确标注可自动修复时使用

## Gate 2 — Duplicate-Origin (unstack)

- 命令: `figma-cli unstack --dry-run`
- 作用域: 当前 Page top-level 节点
- 含义: 仅用于发现 top-level 同位坐标（duplicate origin），不是通用 AABB 检测，也不输出 JSON
- FAIL 条件: 列表非空
- 修复: 把相交节点坐标改为 `figma-cli canvas next` 输出值，重写 + 重检

## Gate 3 — Top-Level AABB

- 命令: `figma-cli run scripts/page-overlap-check.mjs`
- 作用域: 当前 Page 直接子节点之间
- 输出: 公共 envelope + 共享/历史兼容字段
- FAIL 条件: overlapPairs > 0

## Gate 4 — Scoped Children AABB

- 命令: `figma-cli run scripts/overlap-check.mjs`
- 入口常量: `PARENT_IDS = [...]`（修改目标 Section / Frame NodeId 列表）
- 输出: 公共 envelope + `overlapPairs` / `overlaps`
- FAIL 条件: overlapPairs > 0
- 修复: 用 `apply-layout.mjs` 应用新计划，再用本脚本重检

## Gate 5 — Variant Parity

- 命令: `figma-cli inspect --json <id>` 对每个 variant 各跑一次
- 输出矩阵: `(variant, layoutSizingHorizontal, layoutSizingVertical)`
- FAIL 条件: 任意 variant 与多数行的 layoutSizing 不同值
- 修复: 删除该 variant, clone 基线 variant, 修改内容, 保留 `(H, V)`

## Gate 6 — Visual

- 截图保存路径: `.figma/screenshot/<task-id>/`
- 步骤: 实际打开每张最终截图，检查文字裁切、遮挡、对齐、间距、颜色、状态、圆角和层级
- FAIL 条件: 任何视觉问题未修复
- 视觉结论必须写入 `state.validation.visual.summary` 或 `final-summary.md`

## Gate 7 — Containment (v2.2+)

**触发条件:** 任意 Section / Frame / Component / Instance 的 `clipsContent=true` 且至少有一个子节点的 `absoluteBoundingBox` 不完全包含在父节点的 `absoluteBoundingBox` 内。

**命令:** `figma-cli run scripts/overlap-check.mjs`，修改入口常量：
- `PARENT_IDS = [...]`（目标 Section / Frame / Component NodeId 列表）
- `GATE = "containment"`
- `CLIP_WHITELIST = [{ nodeId, rationale }, ...]`（来自 `plan.md##ClipWhitelist`）

**算法:**

```
for parent in PARENT_IDS:
  if !parent.clipsContent: continue       # 不裁切就不告警
  if parent.id in CLIP_WHITELIST[*].nodeId:
    log(INFO, "whitelisted", {parent, rationale})
    continue
  for child in parent.children:
    cb = child.absoluteBoundingBox
    pb = parent.absoluteBoundingBox
    if cb.x < pb.x or cb.y < pb.y
       or cb.x + cb.width  > pb.x + pb.width
       or cb.y + cb.height > pb.y + pb.height:
      side = (left | right | top | bottom) 从失败的不等式推导
      overflowPx = 超出量
      suggestedHeight = pb.height + overflowPx
      emit ISSUE({ gate: "Containment", severity: "error",
                   parentId, parentName, childId, childName,
                   side, overflowPx, suggestedHeight,
                   recommendation })
```

**Whitelist contract:** `plan.md` 必须包含 `## ClipWhitelist` 段（schema 由 `assertValidPlan` 校验）。每项 `{ nodeId, rationale }` 中 `rationale.length >= 5`。缺省视作空数组。

**Gate 语义表:**

| `clipsContent` | In `ClipWhitelist` | Result |
| - | - | - |
| `false` | n/a | PASS (skip) |
| `true`  | yes | PASS (whitelisted) |
| `true`  | no, 有超界子 | FAIL |
| `true`  | no, 无超界子 | PASS |

**多层嵌套:** 每个父独立检查；子节点的子节点超界 → 报告给子节点（直接父），不重复到祖父。这避免双重 FAIL。

**默认策略:** `clipsContent=true` 视为危险。设计者必须通过 `plan.md##ClipWhitelist` 显式 opt-in 并提供 `rationale`（如 scroll container、内部 card）。

**修复:** Workflow 10 收到 ISSUE 后，决定 (a) resize parent 到 `suggestedHeight`，(b) 重新设计不需要裁切，或 (c) 加 whitelist 项。auto-fix **不**自动执行。

## Output Matrices

- LayoutMode 矩阵: 每个节点的 `layoutMode`（NONE / HORIZONTAL / VERTICAL）
- LayoutSizing 矩阵: 每个节点的 `(H, V) = (FIXED | HUG | FILL)`
- BoundingBox 矩阵: 每个节点的 `(x, y, w, h)`
- 兄弟相交矩阵: 来自 `unstack --dry-run` 与 `page-overlap-check.mjs`
- 变体行 parity 矩阵: 每 Component Set 的一行 `(variant, H, V)`

## Failure Priority (Workflow 10)

1. lint 问题: 逐项修；可自动修复的项目用 `--fix`
2. Top-level 重叠: 节点改到 `figma-cli canvas next` 推荐坐标
3. Section 内重叠: `apply-layout.mjs` 一次性应用新坐标 + `overlap-check.mjs` 重检
4. Variant 不一致: 重新 clone 基线再修改
5. Containment FAIL: resize parent 到 `suggestedHeight`，或加 `ClipWhitelist` 项（必须有 `rationale >= 5` 字符）
6. 文字裁切: Visual 层修正

每步必须重新跑对应命令验证通过再进入下一轮，最多三轮。超过三轮立即停止写入。

## Limitations

- TextNode 的 `textAutoResize` 字段 figma-cli 当前不暴露；涉及文字裁切的最终判定仍归 Visual 层。
- `unstack --dry-run` 只报告 duplicate-origin；不要将其作为通用 AABB 矩阵来源。
- 当 `absoluteBoundingBox` 不可用时，`list-children` / `overlap-check` / `inspect-geometry` 必须输出 limitation issue，禁止伪造几何。