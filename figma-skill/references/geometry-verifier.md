# Geometry Verifier Pipeline (Workflow 9 / 10)

Workflow 9 Geometry 层的可执行管线。七道闸门按顺序运行，任一 FAIL 立即停止验收并回到 Workflow 10。

## Gate 1 — Lint

- 命令: **v3 当前未原生实现 lint 子命令**——组合 `figma-cli read canvas`（Page 摘要）+ `figma-cli read list`（Page flat snapshot）+ `figma-cli read nodes --nodes <id1,id2,...>`（按 ID 拉快照），人工或下游工具审查
- 作用域: 当前 Page / 文件
- 判定: 任何异常命名、空位、AABB 越界、绑定缺失视为 FAIL；禁止伪造 lint 子命令占位
- 修复: 按发现项逐项改；待后续 PR 提供 `figma-cli lint` 后替换
- 命令面参考: `bin/figma-cli.exe read --help`

## Gate 2 — Duplicate-Origin (arrange)

- 命令: `figma-cli read arrange --dry-run`
- 作用域: 当前 Page top-level 节点
- 含义: 仅用于发现 top-level 同位坐标（duplicate origin），不是通用 AABB 检测
- FAIL 条件: 列表非空
- 修复: 把相交节点坐标改为执行者基于 `figma-cli read list` 输出自行计算的 next 坐标，重写 + 重检；待后续 PR 提供 `canvas next` 子命令后可替换

## Gate 3 — Top-Level AABB

- 命令: `figma-cli read arrange --apply`（同 Gate 2 但 `--apply` 模式，会真正移动 top-level 节点）
- 作用域: 当前 Page 直接子节点之间
- 备选: 离线分析时使用 `node scripts/page-overlap-check.mjs`（已退役，仅历史归档可调）；v3 任务必须用原生命令
- FAIL 条件: arrange 输出仍有 overlap 或子节点相对父越界

## Gate 4 — Scoped Children AABB

- 命令: `figma-cli read arrange --apply`（同一 Page 上下文）；若 arrange 需 scope 到特定 Section / Frame，先用 `figma-cli read tree <id>` / `read nodes --nodes <id1,...>` 拉子节点几何，再人工或脚本计算 AABB
- 备选: 离线分析时使用 `node scripts/overlap-check.mjs`（已退役）；v3 必须用原生命令
- FAIL 条件: overlapPairs > 0
- 修复: 用 `figma-cli pos <id> --x <x> --y <y>` 逐节点应用新坐标，再跑本 Gate

## Gate 5 — Variant Parity

- 命令: `figma-cli read inspect <id>` 对每个 variant 各跑一次（注：inspect 当前为 stub，PR4 落地；若未实现可临时用 `figma-cli read nodes --nodes <id1,id2,...>` 拉 geometry）
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

**命令:** `figma-cli read arrange --apply`（若 scoped 到特定父：先 `figma-cli read tree <id>` 或 `read nodes --nodes <id1,...>` 拉子节点几何），再叠加人工或脚本比对父子 AABB。

**算法:**

```
for parent in target_parents:
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

**修复:** Workflow 10 收到 ISSUE 后，决定 (a) resize parent 到 `suggestedHeight`，或 (b) 重新设计不需要裁切，或 (c) 加 whitelist 项。auto-fix **不**自动执行。

## Output Matrices

- LayoutMode 矩阵: 每个节点的 `layoutMode`（NONE / HORICAL / VERTICAL）
- LayoutSizing 矩阵: 每个节点的 `(H, V) = (FIXED | HUG | FILL)`
- BoundingBox 矩阵: 每个节点的 `(x, y, w, h)`
- 兄弟相交矩阵: 来自 `read arrange --dry-run` / `read arrange --apply`
- 变体行 parity 矩阵: 每 Component Set 的一行 `(variant, H, V)`

## Failure Priority (Workflow 10)

1. lint 问题: 按 `read canvas` / `read list` / `read nodes --nodes <id1,...>` 收集后逐项修；待 `figma-cli lint` 原生实现后可改用 `--fix`
2. Top-level 重叠: 节点改到执行者基于 `figma-cli read list` 输出的 next 坐标
3. Section 内重叠: `figma-cli pos <id> --x <x> --y <y>` 逐节点应用 + 重跑 Gate 4
4. Variant 不一致: 重新 clone 基线再修改
5. Containment FAIL: resize parent 到 `suggestedHeight`，或加 `ClipWhitelist` 项（必须有 `rationale >= 5` 字符）
6. 文字裁切: Visual 层修正

每步必须重新跑对应命令验证通过再进入下一轮，最多三轮。超过三轮立即停止写入。

## Limitations

- TextNode 的 `textAutoResize` 字段 figma-cli 当前不暴露；涉及文字裁切的最终判定仍归 Visual 层。
- `read arrange --dry-run` 只报告 duplicate-origin；不要将其作为通用 AABB 矩阵来源——AABB 矩阵请走 `read arrange --apply` 模式。
- 当 `absoluteBoundingBox` 不可用时，`read list` / `read nodes` / `read tree` 必须输出 limitation issue，禁止伪造几何。
- v3 当前命令面 `read lint` / `canvas next` 子命令未原生实现；Gate 1 / Gate 2 的修复动作走"先 read 收集，再人工/工具计算"。