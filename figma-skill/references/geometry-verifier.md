# Geometry Verifier Pipeline

Workflow 9 Geometry 层的可执行管线。三道闸门按顺序运行，任一 FAIL 立即停止验收。

## 闸门 1 — lint

- 命令: `figma-cli lint --json`
- 作用域: 当前 Page / 文件
- 输出: lint issue 列表
- FAIL 条件: 列表非空
- 修复: 按 lint 报告逐项改；批量 `--fix` 仅在 lint 报告明确标注可自动修复时使用

## 闸门 2 — unstack --dry-run

- 命令: `figma-cli unstack --dry-run`
- 作用域: 当前 Page top-level 节点
- 输出: top-level 重叠对列表
- FAIL 条件: 列表非空
- 修复: 把相交节点坐标改为 `figma-cli canvas next` 输出值，重写 + 重检

## 闸门 3 — overlap-check.mjs

- 命令: `figma-cli run scripts/overlap-check.mjs`
- 入口常量: `PARENT_ID`（改到目标 Section / Frame 的 NodeId）
- 可选: `OUTPUT_MODE = 'json' | 'summary'`
- 作用域: `PARENT_ID` 直接子节点两两 AABB 相交矩阵
- 输出: JSON `{ total, overlapPairs, overlaps[] }` 或 summary 文本
- FAIL 条件: `overlapPairs > 0`
- 修复: 用 `apply-layout.mjs` 应用新计划，再用本脚本重检

## 闸门 4 — variant 行 parity（辅助，非闸门）

- 命令: `figma-cli inspect --json <id>` 对每个 variant 各跑一次
- 输出矩阵: `(variant, layoutSizingHorizontal, layoutSizingVertical)`
- FAIL 条件: 任意 variant 与多数行的 layoutSizing 不同值
- 修复: 删除该 variant, clone 基线 variant, 修改内容, 保留 `(H, V)`

## 配套脚本（Workflow 7 / Workflow 8）

### list-children.mjs（只读，Workflow 7 baseline）

- 命令: `figma-cli run scripts/list-children.mjs`
- 入口常量: `PARENT_ID`, `ONLY_TYPE`（可选）
- 输出: JSON `{ parent, count, items[] }`
- 用途: 取得 parent 直接子节点 `id / name / type / x / y / w / h / right / bottom`，作为 Workflow 7 baseline 与 Workflow 8 写入前 / 后重读的权威数据源。

### apply-layout.mjs（写，Workflow 8）

- 命令: `figma-cli run scripts/apply-layout.mjs`
- 入口常量: `PLANS = [{id, x, y}, ...]`
- 输出: JSON `{ planned, applied, errors[] }`
- 用途: 把移动计划一次性应用到 Figma；调用前 PLANS 必须经 Workflow 6 审批。
- 重检: 应用后必须用 `overlap-check.mjs` 或 `list-children.mjs` 重读 children bbox 验证一致。

### resize-section.mjs（写，Workflow 8 末尾 / Workflow 9）

- 命令: `figma-cli run scripts/resize-section.mjs`
- 入口常量: `PARENT_ID`, `PAD_X`, `PAD_Y`
- 输出: JSON `{ parent, previous, resized, padding }` 或 `error`
- 用途: 基于 children bbox + padding 收敛 Section / Frame 实际占用空间；调用前 `PARENT_ID` / `PAD_X` / `PAD_Y` 必须经 Workflow 6 审批。

## 输出矩阵总览

- LayoutMode 矩阵: 每个节点的 `layoutMode`（NONE / HORIZONTAL / VERTICAL）
- LayoutSizing 矩阵: 每个节点的 `(H, V) = (FIXED | HUG | FILL)`
- BoundingBox 矩阵: 每个节点的 `(x, y, w, h)`
- 兄弟相交矩阵: 来自 `unstack --dry-run` JSON
- 变体行 parity 矩阵: 每 Component Set 的一行 `(variant, H, V)`

## 失败处理优先级（Workflow 10）

1. lint 问题: 逐项修；可自动修复的项目用 `--fix`
2. Top-level 重叠: 节点改到 `figma-cli canvas next` 推荐坐标
3. Section 内重叠: `apply-layout.mjs` 一次性应用新坐标 + `overlap-check.mjs` 重检
4. Variant 不一致: 重新 clone 基线再修改
5. 文字裁切: Visual 层修正

每步必须重新跑对应命令验证通过再进入下一轮。

## textAutoResize 局限

TextNode 的 `textAutoResize` 字段 figma-cli 当前不暴露；涉及文字裁切的最终判定仍归 Visual 层（Workflow 9 Visual 必须实际打开 `<Current workspace>/temp/figma-screenshot/` 中的截图）。