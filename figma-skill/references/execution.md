# Approved Execution

## Pre-Write Baseline

修改现有文件前必须记录目标及直接依赖的 NodeId、name/type/parent、位置与尺寸、Auto Layout、约束、关键绑定、目标区域截图和当前批次节点清单。

## Command Truth

每个 figma-cli 会话首次使用某命令时必须按下列顺序查询，且 help 输出必须保留至会话结束：

1. `figma-cli <command> --help`（顶层）
2. 当命令含子命令时，`figma-cli <command> <subcommand> --help`
3. 当上面两步未覆盖目标子命令时，禁止执行；禁止凭旧记忆执行。

| 意图 | 必须查 help 的命令族 |
|---|---|
| 发现 | `figma-cli files` / `canvas` / `find` / `get` / `inspect` / `spec` |
| 创建 | `figma-cli create` / `create frame` / `create icon` / `create image` / `create rect` |
| 复用 | `figma-cli instantiate` / `duplicate` / `dup` / `component` / `variants` |
| 修改 | `figma-cli set` / `set-batch` / `padding` / `gap` / `align` / `sizing` / `pin` |
| 结构 | `figma-cli node` / `slot` / `section` / `grid` / `unwrap` |
| 变量 | `figma-cli variables` / `var` / `collections` / `col` / `tokens` / `bind` / `theme` |
| 验证 | `figma-cli verify` / `export` / `lint` / `a11y` / `spec --check` / `inspect --json` / `unstack --dry-run` |
| 恢复 | `figma-cli undo` |
| 几何 | `figma-cli canvas info` / `canvas next` |

子命令必须二次查 help（如 `figma-cli create frame --help`）。

非 figma-cli 运行时（node / python / pwsh / sh / 直接读 JSON / 直接调 Figma REST API）必须按 eval/run gate 同等处理：必须先证明 figma-cli 无原生能力，并取得用户批准。唯一无需 gate 的非 CLI 路径是 `scripts/figma-validate-bounds.mjs`（离线 JSON 分析）。

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
