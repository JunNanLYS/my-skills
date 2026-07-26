# Figma Issue 改进归档规范

## 1. 用途 / 适用阶段 / 读者

- **适用阶段**: Step11(提出改进)
- **不适用**: Step5 写 Spec / Step6 自审 Spec / Step7 写 Plan / Step8 自审 Plan / Step9 执行 Plan
- **读者**: figma-skill 维护者 + 后续会话的 agent
- **目的**: 把使用 figma-cli 与 figma-skill 过程中遇到的问题、改进建议、文档缺漏,以结构化形式归档,供后续版本演进参考

---

## 2. 核心原则(Non-Negotiable)

1. **强制归档触发**: 每次 Step9 执行 Plan 结束(无论成功 / 失败 / 部分失败),必须归档至少 1 份 Issue;若无可改进项,显式声明"无 Issue"并说明理由。
2. **三类问题全覆盖**: Issue 必须覆盖以下三类之一或多类:
   - **命令 / 工具问题**: `figma-cli` 缺失命令 / 参数错误 / 行为不符合预期 / 需要 `eval` 降级
   - **规范 / 流程问题**: spec-template / plan-template / review-spec / review-plan 当前条款不适用或约束过强 / 过弱
   - **文档 / 知识问题**: SKILL.md / references/* / docs/FIGMA_DESIGN_SYSTEM.md 缺失、过时、矛盾
3. **具体到可复现**: 每个 Issue 必须给出复现步骤或触发条件,不得只写"XX 不太好"。
4. **改进方向必须给出**: 每个 Issue 至少给 1 条改进方向(指向具体的 SKILL.md 章节 / reference 章节 / figma-cli 子命令),不得只罗列问题。
5. **不允许占位符**: Issue 不允许 TBD / TODO / "之后再说"。改进方向必须是可立即评估的句子。
6. **不引入已废弃六字段**: 不在 Issue 正文出现 `NativeHelpChecked` / `MissingNativeCapability` / `TargetNodeIds` / `FallbackCodeScope` / `FallbackImpact` / `GeometryReaudit` 六字段门禁语言。
7. **不写入敏感信息**: Issue 不允许包含 daemon token / `~/.figma-ds-cli/` 路径 / API key / 业务凭证。

---

## 3. Issue 文档结构(必填)

每份 Issue 必须包含以下章节。章节顺序固定,不得调整。

```markdown
# Issue: <一句话问题摘要>

> 归档日期: YYYY-MM-DD
> 触发任务: <Spec 文件路径 + Plan 文件路径 或 "无前置任务 / 跨任务观察">
> 触发阶段: <Step5 写 Spec | Step6 自审 Spec | Step7 写 Plan | Step8 自审 Plan | Step9 执行 Plan | Step10 Plan 完成 | 跨阶段观察>
> 严重程度: <P0 阻断 | P1 重要 | P2 一般 | P3 建议>
> 类型: <命令工具 | 规范流程 | 文档知识 | 多类>

## 1. 问题描述
- **现象**: <具体描述,可被他人复现>
- **触发条件**: <什么操作 / 什么命令 / 什么 Spec 内容会触发>
- **影响范围**: <影响哪些任务类型 / 哪些章节 / 哪些 agent 流程>

## 2. 复现步骤
1. <Step 1,具体命令或操作>
2. <Step 2>
3. <观察到的实际结果>

## 3. 期望效果
- <应该是什么样的 / 应该支持什么命令 / 应该怎么改>

## 4. 改进方向
- **方向 A(推荐)**: <具体改动,引用 SKILL.md §X / reference §Y / figma-cli <topic>>
  - 优点: ...
  - 代价: ...
- **方向 B(备选)**: <具体改动>
  - 优点: ...
  - 代价: ...

## 5. 优先级建议
- **是否阻塞当前 skill 使用**: <是 / 否>
- **建议处理窗口**: <立即(v0.x.x) / 下一迭代 / 观望>

## 6. 关联引用
- 关联 Spec: <路径 + §X.Y>
- 关联 Plan: <路径 + Task X>
- 关联 SKILL.md: <§X>
- 关联 reference: <文件名 + §X.Y>
- 关联 figma-cli 子命令: <topic verb>

---

## 附录:本次会话其它 Issue(可选)
| # | 摘要 | 类型 | 严重程度 |
|---|------|------|----------|
| ... | ... | ... | ... |
```

---

## 4. 严重程度分级

| 级别 | 含义 | 处理时效 |
|------|------|----------|
| **P0 阻断** | 当前 skill 无法完成基本任务 / 数据丢失风险 / 不可恢复错误 | 立即修复,不得跨版本 |
| **P1 重要** | 影响效率但不阻断 / 显著违反规范条款但可绕过 | 下一迭代修复 |
| **P2 一般** | 局部小问题 / 单类任务受影响 | 有空时修复 |
| **P3 建议** | 体验改进 / 文档优化 / 命名统一 | 纳入候选池 |

---

## 5. 类型字段细则

| 类型 | 触发场景 | 归档时必须给出 |
|------|----------|----------------|
| **命令工具** | `figma-cli` 子命令缺失 / 参数错误 / 行为与 help 不符 / 必须用 `eval` 降级 | 复现命令 + 期望子命令 / 参数 |
| **规范流程** | spec-template / plan-template / review-spec / review-plan 条款不适用或冲突 | 当前条款引用 + 期望条款 |
| **文档知识** | SKILL.md / references/* / docs/FIGMA_DESIGN_SYSTEM.md 缺失 / 过时 / 矛盾 | 文件路径 + 行号 + 期望内容 |
| **多类** | 跨类型问题(如命令缺失导致规范无法落地) | 每类各给一条改进方向 |

---

## 6. Rationalization 表

| 误区 | 对应规范 | 正确做法 |
|------|---------|---------|
| "执行得很顺,不用写 Issue" | §2 第 1 条 | 每次 Step9 结束必须归档,即使显式声明"无 Issue" |
| "问题太琐碎不值得归档" | §2 第 2 条 | P3 建议类也算 Issue,纳入候选池即可 |
| "Issue 里只写问题就够了" | §2 第 3 / 4 条 | 必须给复现步骤 + 至少 1 条改进方向 |
| "改进方向以后再想" | §2 第 5 条 | Issue 不允许占位符,改进方向必须可立即评估 |
| "把 token / 路径一起带上方便复现" | §2 第 7 条 | 任何敏感凭证禁止写入 Issue,触发即拒绝落盘 |
| "一个 Issue 跨多个任务一次归档" | §3 | 每份 Issue 对应一个原子问题,多问题用附录表 |
| "严重程度默认填 P2" | §4 | 按 §4 分级表判断,不得默认 |

---

## 7. Red Flags

Issue 存在以下任一情况,Step11 必须 FAIL:

1. **无触发任务 / 阶段**: 缺失"触发任务"或"触发阶段"字段
2. **无复现步骤**: §2 复现步骤为空或仅一句"实际中遇到"
3. **无改进方向**: §4 改进方向章节为空
4. **占位符**: Issue 含 TBD / TODO / "之后再说" / "fill in"
5. **非白名单占位符**: 示例含 `<背景色>` `<字号>` `<待补>` 等违规占位符
6. **含敏感信息**: Issue 含 daemon token / `~/.figma-ds-cli/` / API key / 业务凭证
7. **含已废弃六字段**: Issue 正文出现 `NativeHelpChecked` 等已废弃字段门禁语言
8. **跨多个原子问题未拆分**: 一份 Issue 涵盖 ≥ 2 个互不相关的问题
9. **改进方向引用不存在章节**: 引用 SKILL.md §X 但 §X 不存在,或引用 reference 但文件名拼错
10. **无严重程度**: 未填 P0 / P1 / P2 / P3

---

## 8. 头部模板(可复制)

```markdown
# Issue: <一句话问题摘要>

> 归档日期: YYYY-MM-DD
> 触发任务: 
> 触发阶段: 
> 严重程度: 
> 类型: 

## 1. 问题描述
- **现象**: 
- **触发条件**: 
- **影响范围**: 

## 2. 复现步骤
1. 
2. 
3. 

## 3. 期望效果
- 

## 4. 改进方向
- **方向 A(推荐)**: 
- **方向 B(备选)**: 

## 5. 优先级建议
- **是否阻塞当前 skill 使用**: 
- **建议处理窗口**: 

## 6. 关联引用
- 关联 Spec: 
- 关联 Plan: 
- 关联 SKILL.md: 
- 关联 reference: 
- 关联 figma-cli 子命令: 
```

---

## 9. 示例:合规 Issue(命令工具类)

```markdown
# Issue: figma-cli 缺少 read arrange 子命令,导致 Plan 中 <NEXT_X> 占位符无法自动计算

> 归档日期: 2026-07-20
> 触发任务: .figma/plans/2026-07-20-tooltip-pill.md Task 1
> 触发阶段: Step9 执行 Plan
> 严重程度: P1
> 类型: 命令工具

## 1. 问题描述
- **现象**: Plan §3 占位符 `<NEXT_X>` / `<NEXT_Y>` 仅作为示例坐标占位,实际执行时需手动用 `figma-cli read` 系列命令扫描画布,效率低且易误判
- **触发条件**: 任何需要在已有画布上不重叠创建新节点的 Plan Step
- **影响范围**: 所有 Create Component / Create Screen / Create Flow 任务的 Task 1(创建首节点)

## 2. 复现步骤
1. `figma-cli read list` 获取当前 01 Library / Components 节点列表
2. 期望: `figma-cli read arrange --next` 返回下一个不重叠的 (x, y)
3. 实际: 子命令不存在,需手动算 bbox + padding

## 3. 期望效果
- 新增 `figma-cli read arrange --next [--scope <page>]` 子命令
- 返回 `{ x: <number>, y: <number> }` JSON
- 支持 `--padding <n>` 控制与已有节点的安全间距

## 4. 改进方向
- **方向 A(推荐)**: 在 figma-cli 中实现 `read arrange` 子命令,扫当前 Page 所有节点 bbox,返回 min(x_max + padding, ...)
  - 优点: 一次调用,Plan 中 `<NEXT_X>` 可直接换成 `$(figma-cli read arrange --next --x)`
  - 代价: 需扩展 figma-cli 解析逻辑
- **方向 B(备选)**: 离线助手脚本 `scripts/figma-helpers/next-position.mjs`,不依赖 figma-cli 新增子命令
  - 优点: 不阻塞当前 skill 使用
  - 代价: Plan 中 Step 命令更复杂

## 5. 优先级建议
- **是否阻塞当前 skill 使用**: 否(可手动绕)
- **建议处理窗口**: 下一迭代

## 6. 关联引用
- 关联 Spec: .figma/specs/2026-07-20-tooltip-pill.md §3.8
- 关联 Plan: .figma/plans/2026-07-20-tooltip-pill.md Task 1 Step 1.1
- 关联 SKILL.md: §32 Core Command(列出 `read` topic)
- 关联 reference: spec-template.md §2 白名单段
- 关联 figma-cli 子命令: `read` topic
```

---

## 10. 历史背景

issue-template.md 在 figma-skill 早期版本为"用户随手记"风格(单一三列表格),本次按 spec-template / plan-template / review-spec / review-plan 同构升级为正式归档规范,绑定触发阶段 + 严重程度分级 + 类型分类 + 改进方向必填 + 敏感信息红线,作为 Step11 强制归档的依据。