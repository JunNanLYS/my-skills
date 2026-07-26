# Figma Plan 执行规范

> 生效: 所有 Step9 执行 Plan 必须遵循本规范
> 配套规范: `spec-template.md` / `plan-template.md` / `review-spec.md` / `review-plan.md` / `issue-template.md`
> 配套二进制: `figma-cli`(Rust 重写版,位于 `bin/figma-cli.exe`)
> 配套账本: `<Current workspace>/.figma/<task-id>/`

---

## 1. 用途 / 适用阶段 / 读者

- **适用阶段**: Step9(执行 Plan)、Step10(Plan 完成)
- **不适用**: Step4-8 的编写与自审阶段(由对应 reference 规范)
- **读者**: 执行 Figma 修改的 AI agent 或人工操作者
- **目的**: 把已通过 Step8 自审的 Plan 按 Task 顺序落地,记录到 .figma/ 任务账本,产出可验收的 Figma 节点 / 截图 / 文档

---

## 2. 核心原则(Non-Negotiable)

1. **Plan 必须已通过 Step8 自审**: 执行启动条件 = Plan 首部含 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->` 元数据。未通过自审的 Plan 不得进入执行。
2. **只允许 figma-cli 写入**: 所有 Figma 读取、创建、修改、导出、验证必须使用 `figma-cli <group> <verb>` 子命令。禁止 Figma MCP(任何 `figma_mcp_*` 调用),禁止直接读 JSON / 调 REST API / 自行拼接 figma 协议。
3. **每条命令先 `-h`**: 任何 figma-cli 子命令首次使用前必须 `figma-cli <group> -h` 核对参数,把核对结果写在 Step 注释或 Plan 备注中。
4. **duplicate / reparent / unwrap / 组件化 / 组合 variants / 删除重建 / 大幅层级调整后必须重读几何**: 节点 ID 与位置会变,下一步写入必须基于最新 NodeId。
5. **截图必须 Read**: 截图保存到 `<Current workspace>/.figma/screenshot/<task-id>/`,截图后必须用 Read 工具真实读取并报告视觉属性(背景色 / 文字色 / 字号 / 间距 / 对齐),禁止"截图后不读"。
6. **截图对象 = Task 原子节点**: `figma-cli export node <NODE_ID>` 的 NODE_ID 必须是本 Task 产出的原子节点(Create Component → 新组件;Modify Component → 被改节点;Create Screen → 新 Screen Frame;Adjust Tokens → 承载 Token 的代表节点;Create/Modify Flow → Flow 内目标 Screen)。禁止以 Section / Page / 父级 Frame 作为截图对象——会带入无关内容,无法独立验收本 Task 改动。
7. **Token 变更必须同步文档**: 任何 Adjust Tokens Task 的操作步骤必须含同步更新 `docs/FIGMA_DESIGN_SYSTEM.md` 的步骤,Token 改了文档不更新 → FAIL。
8. **状态写入任务账本**: 每 Task 完成时把 task-id / 当前 Task 编号 / Gate 状态写入 `<Current workspace>/.figma/<task-id>/state.json`,失败时回滚到上一个 Task 的快照。
9. **修复优先 / 禁止写报告走人**: 任何 Task 内部 Step 失败必须**先尝试修复**(§4.2 修复循环),不输出"失败报告"假装收敛、不跳过本 Task、不进入下游 Task。失败报告仅在 §4.4 escape hatch 触发时由主对话输出。

---

## 3. 执行前置(必读)

### 3.1 三项检查

执行第 1 个 Task 之前必须完成:

| # | 检查项 | 命令 | 期望结果 |
|---|--------|------|----------|
| 1 | figma-cli 版本 | `figma-cli --version` | 输出版本号,非报错 |
| 2 | daemon 连接 | `figma-cli daemon status` | 已连接 |
| 3 | 当前 Page | `figma-cli page current` | 输出 Page 名(默认 `01 Library`) |

任意一项失败:
- 版本缺失 → 跑 `scripts/install-figma-cli.ps1`
- 未连接 → 跑 `figma-cli connect`,再 `daemon status` 确认
- Page 不存在 → 创建 Page(`01 Library` / `02 Screens` / `03 Flows`)

### 3.2 Plan 元数据校验

```bash
# 提取 Plan 首部自审元数据
head -1 .figma/plans/<plan-name>.md
```

期望: `<!-- self-reviewed-by: SubAgent, date: YYYY-MM-DD, verdict: PASS -->`

未含此行 → 立即停止,要求先回 Step8 自审 Plan。

### 3.3 任务账本初始化

```bash
mkdir -p .figma/<task-id>/screenshot
touch .figma/<task-id>/state.json
echo '{"task-id":"<task-id>","currentTask":0,"gate":"ExecutionGate","status":"RUNNING"}' > .figma/<task-id>/state.json
```

---

## 4. Task 执行循环(每个 Task 必走)

每个 Task 走以下 8 步循环,缺任一步视为 Task 不完整:

```
[1] 读取 Plan Task 章节 → 提取 Files / Reference / Step 列表
   ↓
[2] 读基线 → figma-cli read list / read canvas / read find
   ↓
[3] 写入 → figma-cli create / node / batch
   ↓
[4] 重读几何 → duplicate / reparent / unwrap / 组件化 后必做
   ↓
[5] 命令验收 → figma-cli node check overlap / containment --recursive / page-overlap
   ↓
[6] 验证 → figma-cli read arrange / export node
   ↓
[7] 截图 → figma-cli export node <ATOMIC_NODE_ID> → 保存到 .figma/screenshot/<task-id>/(NODE_ID 必须是本 Task 原子节点,禁止用 Section / Page / 父级 Frame)
   ↓
[8] Read 截图 → 用 Read 工具读取,报告视觉属性(背景色 / 字号 / 圆角 / 对齐)
```

### 4.1 命令验收(Step 5,新增必走)

命令验收使用 figma-cli 只读子命令,在截图之前做几何 / 排布 / 属性自检。**命令验收不通过 → 不进入截图,直接重新**。

| 验收场景 | 命令 | 通过条件 |
|---------|------|----------|
| 重叠检测(parent 内) | `figma-cli node check overlap --parents <id> --fail-on-findings` | 退出码 0 |
| 重叠检测(page 顶层) | `figma-cli node check page-overlap --page <page-id> --fail-on-findings` | 退出码 0 |
| 裁剪检测(嵌套,parent 边界外) | `figma-cli node check containment --parent <id> --recursive --fail-on-findings` | 退出码 0(findings 为空)。`--recursive` 遍历 parent 每个后代并对照其最近 `clipsContent=true` 祖先的边界;无 flag 时只查直接子节点 |
| 属性验收(Token / 数值) | `figma-cli read get --node <id> fills` / `corner-radius` / `width` / `height` / `opacity` | 返回值与 spec §3.7 设计规范来源一致 |

退出码 3(fail-on-findings 触发)→ 输出 findings 列表,**立即进入"修复 → 重跑验收"循环**(同 §4.2 失败处理),不进入截图,不允许"写报告走人"。`read get` 返回值与 spec 不符 → 同等处理。

### 4.2 失败处理(强约束:修复是主路径,禁止"写报告走人")

**核心契约**:任何一步(读取 / 写入 / 重读 / 命令验收 / 截图 / Read 截图)失败,主对话**首先尝试就地修复**(调整参数 / 重读几何 / 重设属性 / 修正坐标 / 换 NodeId …),重跑当前 Step 直到通过,然后**继续本 Task 后续 Step**。**禁止**输出"失败报告"后直接跳入下一个 Task——那是任务逃跑,违反本规范。

```
失败命中 → 进入"修复 → 重跑当前 Step"循环(本 Task 内部,不计入跨 Task 阻塞)
  ↓
重跑通过 → 继续本 Task 后续 Step
  ↓
命中不可重试 / 主对话自身判定无修复方向(反复在同一 Step 失败) → 进入 §4.3 记录 + §4.4 停止判断
```

可重试白名单(每个 Task 无重试次数上限,只要修复方向不重复耗尽即可):
- 参数值错误(字符串拼写 / 数值单位 / NodeId 格式)
- 坐标与已有节点冲突(改用 `<NEXT_X>` / `<NEXT_Y>` 重新计算)
- 单节点创建 / 属性设置失败(读最新 NodeId 后重试)
- 命令验收 findings(重叠 / 嵌套裁剪 / 属性与 spec 不一致)— 修复对应节点后重跑验收
- 截图保存 / Read 报告视觉属性与 spec 不符 — 修节点属性后重截图 + 重读
- 任何"已知根因 → 有明确修复动作"的失败

不可重试的(走 §4.4 立刻停止 Plan,不进入下游 Task):
- 父级 Frame 不存在且未声明创建
- 跨任务依赖未满足(上游 Task 未通过)
- 写入触发 Figma 引擎不可恢复错误(node 死亡 / 协议错误)
- 红线情况(参考 §7)
- 主对话自身反复在同一处失败、无新修复方向的客观僵局

### 4.3 修复尝试账本(本 Task 内部维护)

主对话每次进入"修复 → 重跑"循环时,把 attempts 计数 +1 + lastError + lastScreenshot 写入 `<Current workspace>/.figma/<task-id>/state.json`,便于审计与停止判断:

```json
{
  "taskId": "T-001",
  "attempts": 2,
  "lastError": "NodeId not found after create",
  "lastScreenshot": ".figma/screenshot/T-001/task1-attempt2.png"
}
```

attempts 计数**无上限**——它仅是"在本 Task 上已尝试几次修复"的客观账本,不构成停止条件(停止走 §4.4)。

### 4.4 何时停止 Plan(escape hatch,AI 主对话自主判定)

只有满足以下任一情况时,**主对话停止 Plan 并写 `state.json` 的 `status=STOPPED`**:

- 命中 §4.2 不可重试白名单的任一类(父级缺失 / 跨任务依赖未满足 / Figma 引擎不可恢复错误 / 红线)
- 主对话客观判定已无可修复方向(连续多次修复尝试指向同一根因、或修复动作本身持续触发新的失败)
- 任一上游 Task 失败导致下游 Task 无法进行(见 §8)

停止后**才**走 §6 失败报告模板输出完整上下文(供 Step10 归档)。**正常修复路径下不得输出失败报告**——失败报告 ≠ Step 任务收敛手段。

---

## 5. figma-cli 命令来源

figma-cli 的子命令不在本规范枚举。首次使用任何子命令前必须执行 `figma-cli <group> -h` 核对参数与返回值,把核对结果写在 Step 注释或 Plan 备注中。禁止凭旧版本记忆推断命令存在性 / 参数形态 / 返回结构。

需要枚举的场景仅限以下两类:

| 场景 | 必跑 | 目的 |
|------|------|------|
| 任何新命令首次使用 | `figma-cli <group> -h` | 核对参数表 |
| 命令失败时 | `figma-cli <group> <verb> -h` | 重新核对可能误用的 flag |

---

## 6. 失败报告模板(escape hatch)

**仅在 §4.4 触发停止条件时**输出本报告——它是 escape hatch 出口的产物,不是常规失败处理路径。正常修复路径下(可重试白名单内的失败)由 §4.2 修复循环消化,**不输出本报告**。

```markdown
# Plan 执行失败报告

**Plan**: <路径>
**task-id**: <task-id>
**失败 Task**: <Task N>
**失败 Step**: <Step N.M>
**失败日期**: YYYY-MM-DD

## 1. 受影响节点 NodeId 列表
- <id1> <name1>
- <id2> <name2>

## 2. 已尝试修正清单(本 Task attempts 账本摘录)
- **第 1 次**: <改了什么> → <结果>
- **第 2 次**: <改了什么> → <结果>
- **第 3 次**: <改了什么> → <结果>
- **(续至 attempts=N)**

## 3. 失败截图
- 路径: .figma/screenshot/<task-id>/<step>-attempt<k>.png
- Read 工具读取结果: <视觉属性异常摘要>

## 4. 错误输出
```
<figma-cli stderr>
```

## 5. 主对话客观判定"无可修复方向"的理由
- <为什么认定为客观僵局,而非未尝试修复>
- <已尝试的修复方向枚举>
```

> 注:失败报告不再含"决策建议"列表(删除 / 改写 Plan / 接受红线)——这些动作均由主对话依据 §4.4 自主决定,禁止把决策权抛回用户。

---

## 7. Red Flags

执行过程中出现以下任一情况,立即停止 Plan:

1. **Plan 未自审**: Plan 首部无 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->`
2. **使用 Figma MCP**: 任何 `figma_mcp_*` 调用
3. **未核对 `-h`**: 首次使用 figma-cli 子命令未跑 `-h` 就执行
4. **未重读几何**: duplicate / reparent / unwrap / 组件化 后未 `read nodes` / `read list` 重新读 NodeId
5. **截图未 Read**: `export node` 后未用 Read 工具读取
6. **截图对象错位**: `export node` 的 NODE_ID 不是本 Task 原子节点,而是 Section / Page / 父级 Frame
7. **Token 变更不同步文档**: Adjust Tokens Task 未包含 `FIGMA_DESIGN_SYSTEM.md` 同步步骤
8. **写报告走人 / 跨 Task 跳过**: Task N 验收失败后直接输出"失败报告"进入 Task N+1;或 Task N 失败但 Task N+1 已启动
9. **可重试失败未尝试修复**: 失败命中 §4.2 可重试白名单,但主对话未进入修复循环直接停止 Plan 或直接跳过到下一 Task
10. **含已废弃六字段**: 执行 prompt / 写入文档含 `NativeHelpChecked` 等已废弃字段门禁语言
11. **敏感凭证外泄**: state.json / 写入文档含 daemon token / API key / 凭证路径

---

## 8. 跨任务执行顺序(Plan §3.1 多选时)

Spec 勾选 ≥2 项任务类型时,执行必须按 §3.1 任务执行顺序子节的顺序展开:

```
Task 1 → Create Component → 创建主节点 + Component 注册
   ↓ (Task 1 输出作为 Task 2 输入)
Task 2 → Create Screen → 在 Screen 中实例化 Task 1 Component
   ↓ (Task 2 输出作为 Task 3 输入)
Task 3 → Create Flow → 引用 Task 2 Screen
```

任一上游 Task 失败 → 立即停止,**不进入下游 Task,不写"失败报告"假装已完成走下游**;停止后必须先走 §4.4 escape hatch 判断,只有客观无可修复方向才输出 §6 失败报告并写 `status=STOPPED`。失败报告必须含上游 Task 的受影响 NodeId 列表 + 上一 Task 的失败截图(若已生成)。

---

## 9. 归档收尾(Step10 Plan 完成)

Step9 全部 Task 通过后,主对话必须执行:

1. **截图归档**: 把 `.figma/screenshot/<task-id>/` 下所有截图复制到 `<归档路径>`(由仓库维护策略决定),不在源码树中保留
2. **state.json 定稿**: 写入 `status=COMPLETED`、`completedAt=<timestamp>`、`attempts=<n>`
3. **Plan / Spec 元数据更新**: 在 Plan / Spec 首部追加完成时间戳
4. **Step11 触发**: 跳转 Step11 按 `issue-template.md` 归档本次会话的 Issue(成功 / 失败 / 部分失败均触发)

---

## 10. 历史背景

execution.md 在 figma-skill 早期版本承载了 `eval` 降级的六字段门禁(`NativeHelpChecked` 等),本次按 spec-template / plan-template / review-spec / review-plan / issue-template 同构升级为正式执行规范,绑定 .figma/ 任务账本 + 失败报告模板,作为 Step9 / Step10 的强制执行依据。figma-cli 的具体子命令不在本规范枚举,首次使用前必须通过 `figma-cli <group> -h` 实时核对,避免与二进制版本漂移。本规范明确不沿用旧版六字段门禁,即使原文历史背景中提及,正文也不引入该门禁语言。