# Self-Reflection (Workflow 12)

Workflow 12 是 figma-skill 的最终阶段。无论本任务在 Workflow 11 之后落到 `COMPLETED / FAILED / CANCELLED / SUPERSEDED` 哪一种状态，都必须执行自省并落盘反思文件。

## 自省目的

自省的目标是把"本次会话使用本技能时遇到的问题"和"后续可执行的优化方向"记录成可索引、可追溯的文本，供：

- 后续会话作为回顾材料（避免重复犯错）；
- 维护者作为版本升级时的输入；
- 测试套件作为新规则的触发器。

自省**不**重做 Figma 写入，不修改 `.figma/tasks/<task-id>/` 内任何已签发的 `state.json`、`plan.md`、`todo.md`、`events.jsonl` 或 `recovery.md`。

## 存储路径与命名

```text
<Current workspace>/.figma/feedback/<timestamp>.md
```

- `<Current workspace>` 是 SKILL.md 中的占位符，由当前会话解析为真实工作目录；本仓库中即 `D:\ai-skills`。
- `<timestamp>` 使用 **ISO 8601 文件名安全形式**：`YYYY-MM-DDTHH-MM-SS`，以本地时区时间为准。
- 文件名**只含时间戳**，不嵌入 task id、skill name 或 stage 名称，避免命名分歧；同一秒出现多次自省时由 `figma-task-state.mjs reflect` 追加 `-001`、`-002` 后缀。
- 目录 `<workspace>/.figma/feedback/` 跨任务共享；新建会话第一次写入时自动创建。

## 文件结构（强制）

每份自省文件必须满足以下结构，否则 `SelfReflectionGate=FAIL`：

```text
# figma-skill v2.1 Self-Reflection
<!-- skill-version: 2.1 -->

## 1. 问题列表 (Problems)

| # | 问题 | 出现的 Workflow | 影响 |
| - | ---- | ---------------- | ---- |
| 1 | ...  | Workflow 6       | ...  |

## 2. 优化方向 (Optimization Directions)

| # | 优化方向 | 优先级 | 关联问题 |
| - | -------- | ------ | -------- |
| 1 | ...      | P1     | 问题 #1  |
```

要求：

1. 首行必须是 `# figma-skill v2.1 Self-Reflection`，第二行是 `<!-- skill-version: 2.1 -->` 注释行；版本字串必须与当前 SKILL.md 的 `version` 字段一致。
2. 两个表头**必须同时存在**：`问题列表` 与 `优化方向`；只写一张视为 Gate FAIL。
3. 每个表至少 1 行；空表或只有表头同样 FAIL。
4. 优先级列只允许 `P0 / P1 / P2`，含义：
   - `P0`：阻塞，必须在下一个 minor 版本修复；
   - `P1`：影响质量，建议下一个 minor 修复；
   - `P2`：体验改进，可在补丁版本修复。
5. "关联问题"列引用上一张表的 `#` 编号，例如 `问题 #2`；跨表引用必须能在文件中找到对应行。

## 写入与校验

`figma-task-state.mjs reflect` 是唯一允许写入自省文件的入口：

```text
figma-task-state.mjs reflect --skill-version 2.1 --output .figma/feedback/<timestamp>.md
```

行为：

- 自动创建 `.figma/feedback/` 目录；
- 模板化生成首行 + 注释行 + 两个表头；
- 校验 `skill-version` 与 SKILL.md 当前 `version` 字段一致；
- 拒绝把 daemon token、`~/.figma-ds-cli/` 绝对路径、`Authorization` 头写入文件内容（命中 S23 时拒绝落盘）。
- 文件落盘后必须 `size > 0` 且包含两个表头子串；否则写回空白并 `SelfReflectionGate=FAIL`。

## 与现有阶段的关系

| 上一阶段 | 触发条件 | 强制吗 |
| -------- | -------- | ------ |
| `COMPLETED`  | Workflow 11 PASS 且 `archiveStatus=ARCHIVED` | 是 |
| `FAILED`     | Workflow 11 FAIL 且 `archiveStatus=ARCHIVE_FAILED` | 是 |
| `CANCELLED`  | 用户显式取消 | 是 |
| `SUPERSEDED` | 被新任务替换 | 是 |
| `BLOCKED`    | 暂不归档 | 否（保留截图以备恢复） |
| `STALE`      | 暂不归档 | 否 |
| `NEEDS_REPLAN` | 暂不归档 | 否 |

`Audit` / `Export` 类型的 read-only 任务同样必须执行自省；自省不构成 Figma 写入。

## Red Flags

- "任务小，不需要自省" → 错；规模与是否自省无关。
- "时间戳已存在，复用旧文件" → 错；每次必须新建文件，覆盖视为 FAIL。
- "把多个问题合并成一行" → 错；每个观察必须独立成行，便于跨会话检索。
- "优化方向里只写'继续观察'" → 错；优化方向必须是可执行动作，含优先级和关联问题。

## 失败回退

自省落盘失败（磁盘满、权限、S23 命中、版本不匹配）时：

1. `figma-task-state.mjs reflect` 返回非零退出码；
2. `events.jsonl` 写入 `SELF_REFLECTION_FAILED` 事件；
3. `SelfReflectionGate=FAIL`，归档进入 `ARCHIVE_FAILED` 并保留 lease；
4. 维护者必须人工补写 `.figma/feedback/<timestamp>.md`，再次运行 `reflect` 校验通过后才允许 `archiveStatus=ARCHIVED`。