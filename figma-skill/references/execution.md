# Approved Execution (Workflow 6 / 7 / 8)

## Pre-Write Baseline (Workflow 7)

修改或扩展前必须记录目标及直接依赖的 NodeId、name/type/parent、位置与尺寸、Auto Layout、约束、关键绑定、目标区域截图和当前批次节点清单。所有数据来自 `scripts/list-children.mjs` 或 `figma-cli inspect --json`，不得使用历史快照替代实时读取。

## Singular Environment Order (Workflow 1)

每个新 figma-cli 会话必须按下列顺序执行：

```text
figma-cli --version
figma-cli --help
figma-cli status
  若 connected-to-figma 且 daemon-running → 直接进入下一步
  否则 figma-cli connect (不传 --safe，除非用户明确批准) 后再 status 一次
```

任何后续 `figma-cli <command> --help` 输出必须保留到 Workflow 11 交付报告。

## Command Truth

每个 figma-cli 会话首次使用某命令时必须按下列顺序查询，且 help 输出必须保留至会话结束：

1. `figma-cli <command> --help`（顶层）
2. 当命令含子命令时，`figma-cli <command> <subcommand> --help`
3. 当上面两步未覆盖目标子命令时，禁止执行；禁止凭旧记忆执行。

非 figma-cli 运行时（node / python / pwsh / sh / 直接读 JSON / 直接调 Figma REST API）必须按 eval/run gate 同等处理：必须先证明 figma-cli 无原生能力，并取得用户批准。唯一无需 gate 的非 CLI 路径是 `scripts/figma-validate-bounds.mjs`（离线 JSON 分析）和 `figma-task-state.mjs`（离线任务账本）。

## Unified `eval/run` Contract

只有当 CommandPlan 的 `EvalRunFallback` 段提供六个事实字段且用户批准时才允许使用 `eval/run`：

1. `NativeHelpChecked` —— 已检查的 figma-cli 顶层帮助文本；
2. `MissingNativeCapability` —— 已检查的最接近意图子命令帮助及其确实缺少该能力；
3. `TargetNodeIds` —— 降级影响的 NodeId 列表；
4. `FallbackCodeScope` —— 降级代码的精确范围；
5. `FallbackImpact` —— 影响半径；
6. `GeometryReaudit` —— 几何再校验方式。

`eval/run` 禁止跨任务共享临时变量；完成后必须重读受影响节点并完整验证。

## Geometry-aware Commands

| 需要 | 命令 |
| --- | --- |
| 文件级 lint | `figma-cli lint [--json] [--fix]` |
| Top-level 同位坐标检测 | `figma-cli unstack --dry-run`（仅用于发现 duplicate-origin） |
| 列 Page 范围 | `figma-cli canvas info` |
| 取非重叠坐标 | `figma-cli canvas next` |
| 列 Section children | `figma-cli run scripts/list-children.mjs` |
| 单节点几何 + sizing | `figma-cli inspect --json <id>` |
| Section 内 AABB 相交矩阵 | `figma-cli run scripts/overlap-check.mjs` |
| Page top-level AABB | `figma-cli run scripts/page-overlap-check.mjs` |
| 单节点完整几何 | `figma-cli run scripts/inspect-geometry.mjs` |
| 移动计划应用 | `figma-cli run scripts/apply-layout.mjs` |
| 收敛 Section size | `figma-cli run scripts/resize-section.mjs` |

调用项目预设助手脚本时必须遵守 figma-cli 沙箱约束：

- 不透传 `--arg`；调用前编辑脚本顶部 `TASK_ID` / `BASELINE_REVISION` / `PARENT_IDS` / `EXPECTED_PARENT_TYPE` / `PAD_X` / `PAD_Y` / `PLANS` 等入口常量。
- plugin sandbox 无 `process` / 环境变量访问。
- 写入类脚本（`apply-layout` / `resize-section`）必须先在 Workflow 6 审批。
- 调用只读类（`list-children` / `overlap-check` / `page-overlap-check` / `inspect-geometry` / `figma-validate-bounds`）无需再次提供六字段事实链。

## Offline State Helper

`scripts/figma-task-state.mjs` 是 v2 任务账本 CLI。它只读写项目内 `.figma/`，不与 Figma daemon 通信，不调用 git，不在跨任务上下文中缓存任何运行时状态。CommandPlan 的 `Cmd` 段可以引用以下子命令，调用前必须先 `init-project` 并 create 对应 task：

| 子命令 | 用途 |
| --- | --- |
| `init-project` | 创建 `.figma/`，写入 `config.json` / `index.json`，复制 schema |
| `create` | 新建 task ledger（state.json / plan.md / todo.md / recovery.md / events.jsonl / evidence/manifest.json） |
| `list` | 从 index 读摘要 |
| `show` | 输出 `state.json` + `recovery.md` |
| `acquire` / `renew` / `takeover` / `release` | 任务 WRITE 租约 |
| `checkpoint` | 修订号校验 + 状态/事件/state/index/recovery/lease 事务 |
| `todo-add` / `todo-update` | 解析 4 行 Markdown Todo 并写 `TODO_UPDATED` |
| `evidence-add` | SHA-256 + redaction + manifest 写入 |
| `screenshot-add` | `.figma/screenshot/<task-id>/` 截图元数据 |
| `validate` | 全 `.figma/` 只读一致性验证 |
| `archive` | 终态压缩归档（删除截图、压缩 evidence、生成 final-summary.md） |
| `close` | 仅在 `ARCHIVED` 时释放租约 |

## Small-Batch Loop

每批固定执行：

1. 读取目标状态；
2. 完成最小相关写入；
3. 重新读取受影响节点；
4. 检查结果；
5. 正确后才进入下一批。

在 duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId 和几何再写入。

通用定义必须放在组件或 Library page，UI page 消费实例或批准的 duplicate。禁止凭记忆重画已有组件。

## Failure and Recovery

部分成功或严重偏差必须停止后续批次。只有当前帮助和批次历史确认 `undo` 精确撤销最近目标 `render`/`render-batch` 时才允许使用，否则保留现场并报告。禁止连续破坏性恢复。

`figma-task-state.mjs` 不替代 undo；它只能记录审批痕迹与事件，undo 仍由 figma-cli 处理。