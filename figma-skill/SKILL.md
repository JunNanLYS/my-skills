---
name: figma-skill
model: sonnet
category: design
description: Use when creating, modifying, extending, or validating product UI, components, variables, tokens, responsive layouts, or design systems in Figma or through figma-cli; also use when a request mentions Figma, figma-cli, or NodeId.
version: 1.0
---

# Figma End-to-End Execution

将用户需求转化为可编辑、可复用、经过实际截图验收的 Figma 产品 UI。覆盖从零创建与修改现有文件；首版聚焦 Web、桌面端、移动端 UI 及设计系统。

## Non-Negotiable Rules

- 所有 Figma 读取、创建、修改、导出和验证必须使用 `figma-cli`。
- 禁止使用 Figma MCP、其他 Figma CLI 或 GUI 自动化作为替代路径。
- 每个新会话首次执行 Figma 任务时，必须先运行 `figma-cli connect`，再运行 `figma-cli status`。
- `[当前工作区]/docs/FIGMA_DESIGN_SYSTEM.md` 是唯一设计规范来源。
- 设计系统审批与 Figma 首次写入审批是两次独立审批；前者禁止被解释为后者。
- 只有当前 CLI 顶层帮助和最接近意图的子命令帮助都证明缺少原生能力，并且用户批准该精确降级时，才允许使用 `eval/run`。
- duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId 和当前几何。
- 首版禁止创建跨任务持久缓存。任务内上下文禁止替代写入前实时读取。
- 验证失败最多自动修正三轮；第三轮后仍失败必须停止写入并完整报告。
- 硬性要求必须用“必须”“禁止”“只有……才允许”；禁止用弱措辞稀释门禁。

## State Machine

```text
接收需求
→ 确认当前工作区
→ 检查或安装 figma-cli
→ Yolo 连接与状态检查
→ 只读发现目标上下文
→ 检查 docs/FIGMA_DESIGN_SYSTEM.md
→ 必要时补建设计系统并完成第一次审批
→ 形成 Figma 执行方案并完成第二次审批
→ 记录修改基线
→ 小批次写入并逐批重读
→ 结构、视觉、规范三层验证
→ 最多三轮最小修正
→ 交付或报告未通过项
```

只澄清会改变平台、核心用户与任务、信息架构、品牌方向、关键交互、响应式范围或业务边界的问题。其他设计决策必须先查设计系统文档；文档没有依据时才采用专业默认值。

## Approval Gates

### Gate 1 — Design System

文档缺失或缺少当前任务规则时，必须先提出最小必要规范，说明依据、影响和范围外冲突，并等待明确批准。批准后才允许写入 Markdown。该批准禁止授权任何 Figma 写入。

### Gate 2 — Figma Write

设计系统确定后，必须提交目标范围、复用/创建策略、组件与变量改动、布局与响应式方案、冲突修正范围、基线与批次、`eval/run` 证据、验证标准，并等待明确批准。结构、规范、范围、共享组件或降级方式实质变化时，必须重新审批。

## Reference Loading

按阶段只读取对应文件：

- 环境检查、Windows 安装、Yolo 连接：`references/installation.md`
- 设计系统文档、缺项、冲突和第一次审批：`references/design-system.md`
- 只读发现、任务内上下文、复用决策和第二次审批：`references/discovery-and-planning.md`
- 已批准写入、命令选择、NodeId、`eval/run` 和恢复：`references/execution.md`
- 三层验收、截图、修正循环与交付：`references/validation.md`

## Red Flags — Stop

- “MCP 已连接，先用它更快。”
- “用户说不用打扰，所以缺失规范可直接用默认值。”
- “`eval` 仍属于 CLI，不必查原生命令。”
- “duplicate 后旧 ID 通常还能用。”
- “导出成功等于视觉正确。”
- “三轮后再试一次也许就好。”
- “先改 Figma，文档稍后补。”

出现任一想法都必须停止，返回对应门禁。

## Rationalizations Observed in Baseline Tests

| 基线中的合理化 | 强制回应 |
|---|---|
| “MCP 已可用，安装 CLI 增加风险和延误。” | 必须从官方稳定 GitHub Release 安装并验证 `figma-cli`；失败即停止，禁止替代工具。 |
| “用户授权 sensible defaults 且不想被打扰。” | 权威文档缺少当前规则时，必须先补充最小规范并获得独立批准。用户的催促禁止跨越规范门禁。 |

## Completion Gate

只有同时满足以下条件才允许报告完成：

- 批准范围内写入已执行；
- 结构、视觉、规范三层验证全部通过；
- 最终截图已实际打开检查并归档；
- 当前任务符合 `docs/FIGMA_DESIGN_SYSTEM.md`；
- 没有未披露的失败、范围变化或未经批准的降级；
- 三轮修正仍失败时已停止写入并给出完整失败报告。
