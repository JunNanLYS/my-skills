---
name: figma-guide
model: sonnet
category: design
description: Figma CLI 优先的设计执行指南——统一使用 silships/figma-cli 2.x（`figma-cli` / `figma-ds-cli`），聚焦组件复用、局部坐标与 NodeId 纪律、截图验证，以及 `figma-validate-bounds` 这个离线越界审计脚本。触发条件：消息包含 Figma / figma / figma-cli / NodeId 任一词时加载；避免被泛用动词误触发。
version: 5.0
---

## 触发条件

仅当用户消息**包含 `Figma` / `figma` / `figma-cli` / `NodeId` 任一词**（中英文不限）时执行本 Skill。

如果消息里没有这些词，即使涉及 UI / 颜色 / 组件，也**跳过**本 Skill —— 那通常是代码任务（Vue / React / Tailwind 等）。

## 规范前置摘要

执行任何 Figma 任务前，先记住这 12 条：

1. **统一使用同一个 CLI**：默认使用 `silships/figma-cli` 2.x，对外命令优先写 `figma-cli`。
2. **统一遵循当前 CLI 语法**：命令形态以 `figma-cli --help` 和对应子命令 help 为准，不混用其他历史文档里的写法。
3. **不会写命令就先问 CLI**：先跑 `figma-cli --help`，再看 `figma-cli <command> --help` / `figma-cli <command> <subcommand> --help`。
4. **创建视觉节点优先用 CLI 原生命令**：单个结构用 `render`，多个独立结构用 `render-batch`，页面级布局先看 `blocks`，不要用 `eval` 新建视觉节点。
5. **重复视觉单元先复用**：优先 `spec` / `instantiate`、组件/实例或 clone，不要凭印象重画。
6. **组件定义放在组件页**：UI 页消费复用结果，不在页面里重复定义通用组件。
7. **用户要 N 个同类对象时给 N 个独立节点**：不要包成一个 wrapper Frame 或一个包含 N 项的 Component。
8. **坐标是父容器局部坐标**：新建后先放进目标父容器，再设本地 `x / y / w / h`。
9. **NodeId 不能凭记忆复用**：结构重排、clone、重建后都要重新读取验证。
10. **Token 不硬编码**：颜色、字号、圆角、间距优先查项目设计系统和变量；用户命名 collection 时必须显式 `--collection <name>`。
11. **改父框时先判断是否真的需要离线审计**：优先使用 `figma-cli` 原生命令做布局与约束调整；只有怀疑父子越界、裁切或局部坐标异常时，再跑 `figma-validate-bounds.mjs` 做基线检查。
12. **导出图优先走 CLI 原生命令并实际看图**：优先用 `figma-cli verify --save` 或 `figma-cli export ... -o ...` 落 PNG，再打开截图检查文字、颜色、遮挡和对齐。

## CLI-only 主路径

### 1. 使用哪个 CLI

本 Skill 的唯一 CLI 入口是：

- 仓库：`https://github.com/silships/figma-cli`
- 首选命令：`figma-cli`
- 等价别名：`figma-ds-cli`

执行时默认规则：

- 文档和示例统一写 `figma-cli`。
- 若本机只有 `figma-ds-cli`，可视为等价替代。
- 不再混用历史文档里的其他 Figma CLI 命令形态。

### 2. 如何连接 Figma

连接时默认走新 CLI 的原生命令：

- `figma-cli connect`：默认就是 **Yolo 模式**。
- `figma-cli connect --safe`：需要插件桥接时再用安全模式。
- `figma-cli status`：先看当前是否已连接、daemon 是否可用。
- 若提示 daemon 未运行，再看 `figma-cli daemon --help`。
- 若需要回滚 Yolo patch，用 `figma-cli unpatch`。

### 3. 不知道命令怎么写时怎么办

不要在 Skill 里硬背大段命令清单；让 AI 直接向 CLI 自查：

1. 先看顶层：`figma-cli --help`
2. 再看命令组：`figma-cli <command> --help`
3. 再看子命令：`figma-cli <command> <subcommand> --help`
4. 若不确定当前文件/连接状态，先看：`figma-cli status`
5. 若不确定当前打开了哪些文件，先看：`figma-cli files`

原则：

- **先自查 help，再执行真实改动**。
- 不要凭旧记忆假设参数名或子命令名。
- 不要把别的 CLI 语法套到这个仓库上。

### 4. 结构与验证仍按本 Skill 的纪律执行

CLI 入口已经统一，但设计执行纪律不变：

- 先判断是否应复用组件或 clone 现有结构。
- 再按父容器本地坐标放置和调整几何。
- 每次结构变化后重新读取关键节点，避免拿旧 NodeId 继续写。
- 改父框尺寸时，优先用 CLI 的布局、pin、sizing、inspect 等原生命令处理；只有怀疑存在越界、裁切或局部坐标异常时，才运行 `figma-validate-bounds.mjs` 做离线审计。
- 导出图后必须写盘并 Read，不能只看“导出成功”。优先使用 `figma-cli verify --save` 或 `figma-cli export ... -o ...`。

复用模式、组件页纪律、Section 模式、批量/串行规则见 `references/workflow.md`。
验证口径见 `references/validation.md`。
本地辅助脚本参数见 `references/scripts.md`。

## 文档索引

- `references/cli.md`
  - 何时看：需要确认仓库地址、安装/更新方式、Yolo 连接方式、或者想知道如何向 CLI 自查命令时。
- `references/workflow.md`
  - 何时看：需要处理组件页、结构复用、坐标放置、NodeId、Section、批量操作时。
- `references/validation.md`
  - 何时看：需要做导出验收、截图核对、父框 resize、自检收尾时。
- `references/scripts.md`
  - 何时看：需要调用 `figma-validate-bounds.mjs` 做离线几何审计时。

## 当前约束

- 本 Skill 的 CLI 路径已经统一切换到 `silships/figma-cli` 2.x。
- 对外只保留 `figma-cli` / `figma-ds-cli` 这组命令。
- 其他历史性的 CLI 路径、旧语法和环境状态描述都视为过期内容，不再引用。
