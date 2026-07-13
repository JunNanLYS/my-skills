# Approved Execution

## Pre-Write Baseline

修改现有文件前必须记录目标及直接依赖的 NodeId、name/type/parent、位置与尺寸、Auto Layout、约束、关键绑定、目标区域截图和当前批次节点清单。

## Command Truth

陌生语法必须按顺序查询：

1. `figma-cli --help`
2. `figma-cli <command> --help`
3. `figma-cli <command> <subcommand> --help`

当前帮助是唯一命令真相，禁止凭旧记忆执行。

| 意图 | 必须先检查的原生入口 |
|---|---|
| 发现 | `files`、`canvas`、`find`、`get`、`inspect`、`spec` |
| 创建 | `render`、`render-batch`、`blocks`、`shadcn` |
| 复用 | `instantiate`、`duplicate|dup`、`component`、`variants` |
| 修改 | `set`、`set-batch`、`padding`、`gap`、`align`、`sizing`、`pin` |
| 结构 | `node`、`slot`、`section`、`grid`、`unwrap` |
| 变量 | `variables|var`、`collections|col`、`tokens`、`bind`、`theme` |
| 验证 | `verify`、`export`、`lint`、`a11y`、`spec --check` |
| 恢复 | `undo` |

当前复制命令是 `duplicate|dup`，禁止使用过期拼写。

## Geometry-aware Commands

- 必须使用 silships/figma-cli 当前帮助确认 geometry-affecting 命令集合（sizing、pin、padding、gap、align、auto-layout 等）当前是否原生可用。被合并或拆分的命令以最新帮助为准。
- `duplicate|dup` 会改变父级 NodeId 与 bounding box，必须 Workflow 8 重读。

## Small-Batch Loop

每批固定执行：

1. 读取目标状态；
2. 完成最小相关写入；
3. 重新读取受影响节点；
4. 检查结果；
5. 正确后才进入下一批。

在 duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId 和几何再写入。

通用定义必须放在组件或 Library page，UI page 消费实例或批准的 duplicate。禁止凭记忆重画已有组件。

## `eval/run` Gate

只有五项事实全部记录时才允许使用 `eval/run`：

1. 已检查 `figma-cli --help`；
2. 已检查最接近意图的 command/group help；
3. 当前帮助确实没有原生能力；
4. 已批准方案包含精确降级、目标 NodeId 和影响范围；
5. 用户批准了这一精确降级。

审批后才发现缺失能力时，必须暂停并补充方案。`eval/run` 必须限制到命名 NodeId；禁止无范围遍历或批量改动。完成后必须重读并完整验证。

## Failure and Recovery

部分成功或严重偏差必须停止后续批次。只有当前帮助和批次历史确认 `undo` 精确撤销最近目标 `render`/`render-batch` 时才允许使用，否则保留现场并报告。禁止连续破坏性恢复。
