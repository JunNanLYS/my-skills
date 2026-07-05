---
name: figma-guide
model: sonnet
category: design
description: Figma CLI 优先的设计执行指南——聚焦组件复用、坐标与 NodeId 纪律、截图验证，以及 `figma-save-export` / `figma-resize` / `figma-validate-bounds` 三个本地辅助脚本。触发条件：消息包含 Figma / figma / figma-cli / NodeId 任一词时加载；避免被泛用动词误触发。
version: 2.1
---

## 触发条件

仅当用户消息**包含 `Figma` / `figma` / `figma-cli` / `NodeId` 任一词**（中英文不限）时执行本 Skill。

如果消息里没有这些词，即使涉及 UI / 颜色 / 组件，也**跳过**本 Skill —— 那通常是代码任务（Vue / React / Tailwind 等）。

## 规范前置摘要

执行任何 Figma 任务前，先记住这 10 条：

1. **默认走 CLI-first**：先确认 CLI 状态，再进入设计执行。
2. **重复视觉单元先复用**：优先组件/实例或 clone，不要凭印象重画。
3. **组件定义放在组件页**：UI 页消费复用结果，不在页面里重复定义通用组件。
4. **坐标是父容器局部坐标**：新建后先放进目标父容器，再设本地 `x / y / w / h`。
5. **NodeId 不能凭记忆复用**：结构重排、clone、重建后都要重新读取验证。
6. **Token 不硬编码**：颜色、字号、圆角、间距优先查项目设计系统和变量。
7. **批量处理重复操作**：同类节点尽量批量处理，不要一次建 50+ 节点再回头排错。
8. **改父框前先查越界**：先跑 `figma-validate-bounds.mjs`，知道当前基线。
9. **改父框后再重算子节点**：必要时用 `figma-resize.mjs` 输出 plan，再做二次越界检查。
10. **导出图必须写盘并 Read**：先用 `figma-save-export.mjs` 落 PNG，再打开截图检查文字、颜色、遮挡和对齐。

## CLI-first 主路径

### 1. 先确认 CLI 状态

优先检查本机是否真的能运行 CLI：

- `command -v figma`
- `figma list`
- 若未安装全局命令，再看 `references/cli.md`

如果当前环境无法完成 smoke test，就把状态写成 **当前环境待验证**，不要写成“已可用”。

### 2. 读取并缓存文件 / 页面上下文

首次进入某个 Figma 文件时：

- 先读取当前文件与页面上下文。
- 将结果缓存到 `<项目根>/.figma/state.json`。
- 后续任务优先命中缓存，再补读当前 page 内的节点树。

上下文字段、刷新时机、命令形态见 `references/workflow.md`。

### 3. 按复用、坐标与 NodeId 纪律执行

执行设计改动时只做三件事：

- 先判断是否应复用组件或 clone 现有结构。
- 再按父容器本地坐标放置和调整几何。
- 每次结构变化后重新读取关键节点，避免拿旧 NodeId 继续写。

复用模式、组件页纪律、Section 模式、批量/串行规则见 `references/workflow.md`。

### 4. 只要改父框尺寸，就走 bounds → resize → bounds

改任何复合节点父框 `w / h` 时：

1. 先跑 `figma-validate-bounds.mjs` 拿当前越界基线。
2. 如有位移或缩放需求，用 `figma-resize.mjs` 生成子节点 plan。
3. 应用 plan 后再次跑 `figma-validate-bounds.mjs`。
4. 只有越界为 0，才算这一步通过。

完整流程见 `references/validation.md` 和 `references/scripts.md`。

### 5. 导出后必须做截图验收

导出只是开始，不是完成：

1. 导出节点结果。
2. 用 `figma-save-export.mjs` 写成 PNG。
3. 打开截图逐项核对。
4. 没有 Read 过截图，就不能向用户报告“已完成”。

截图检查清单见 `references/validation.md`。

## 文档索引

- `references/workflow.md`
  - 何时看：需要处理组件页、结构复用、坐标放置、NodeId、Section、批量操作时。
- `references/validation.md`
  - 何时看：需要做导出验收、截图核对、父框 resize、自检收尾时。
- `references/cli.md`
  - 何时看：需要安装 CLI、确认命令形态、检查退出码、判断当前环境是否可运行时。
- `references/scripts.md`
  - 何时看：需要调用 `figma-save-export`、`figma-resize`、`figma-validate-bounds` 时。

## 当前 CLI 状态

当前目录内的技能文档已经按 CLI-first 路径重写，但**本机 CLI 仍需单独验证**。

当前只读核实结果：

- `figma` 命令**不在 PATH**。
- `npx` **可用**。
- 全局 npm 包列表中**未看到** `@nono/figma-cli`。

因此当前应将 CLI 描述为：

- **工作流已设计好**；
- **命令形态已整理到 `references/cli.md`**；
- **本机是否可直接执行，仍需后续 smoke test 确认**。
