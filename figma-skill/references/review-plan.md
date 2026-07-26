# Figma Plan 自审规范

> 生效: 所有 Step8 Plan 自审必须遵循本规范
> 配套规范: `plan-template.md`(Step8 自审的依据)
> 同构规范: `review-spec.md`(本文件与该文件结构对齐)

---

## 1. 用途 / 适用阶段 / 读者

- **适用阶段**: Step8(自审 Plan)
- **不适用**: Step6 自审 Spec(由 `review-spec.md` 规范)、Step9 执行 Plan(由 execution 流程规范)
- **读者**: 执行 Plan 自审的 AI agent(强制 SubAgent,详见 §3)
- **目的**: 在不打扰用户的前提下,由 SubAgent 对 Plan 做一次独立、客观的合规审计,产出 PASS / FAIL 结论与逐条证据

---

## 2. 核心原则(Non-Negotiable)

1. **强制 SubAgent 自审**: Step8 必须通过 `Agent` 工具派发**独立 SubAgent** 执行自审,禁止主对话"自己写完自己审"。SubAgent 上下文必须洁净,不得携带主对话的写作推理。

2. **必读前置**: SubAgent 在审查前必须**强制 Read 一次** `plan-template.md` 全文,并以该规范的 §3 文档结构 + §5 与 Spec 衔接检查表 + §8 Red Flags 共 11 条作为审查依据。任何跳过此 Read 步骤的审查一律视为无效。

3. **逐条对照**: SubAgent 必须对 §8 Red Flags 11 条**逐条打勾**或**逐条打叉**,每条必须给出**具体证据**(文件行号 / 引用文本片段 / 缺失原因)。任何"差不多就行"或"我已检查"的笼统回答一律 FAIL。

4. **红线可修复重审**: 发现以下任一情况,SubAgent 必须立即判定 FAIL;主对话必须**就地自主修复**,然后**新派 SubAgent 重审**;禁止把红线条目抛回用户裁定:
   - Plan 含 TBD / TODO / "之后再说" / "fill in" / 占位符(白名单外)
   - Plan 派生自未通过 Step6 自审的 Spec(缺失 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->` 元数据)
   - Plan 任务类型与 Spec 勾选不一致
   - Plan 复述 Spec 原文 ≥ 3 行
   - Plan 含已废弃六字段门禁语言(`NativeHelpChecked` 等)

5. **零度容忍冗余**: SubAgent 不得在审查结论中复述 Plan 原文超过 5 行;必须以"§X.Y 第 N 条 → 状态 / 证据"结构化呈现。复制粘贴型报告一律 FAIL。

6. **失败可无限重审**: 同一份 Plan 的 SubAgent 自审**无轮次上限**——主对话必须在每轮 FAIL 后就地自主修复并新派 SubAgent,直到取得 PASS。仅在主对话自身判定"修复已无方向 / 反复在同一处失败"等非轮次原因时,才停止重审并向用户报告完整失败上下文。

---

## 3. SubAgent 派发契约(必读)

### 3.1 派发方式

```text
主对话 Agent(本主进程)
  └─ Agent(subagent_type=general-purpose, prompt=<审查 prompt 模板>)
       └─ SubAgent: 洁净上下文, 仅 Read plan-template.md + 待审 Plan 文件 + 配套 Spec 文件
            └─ 输出: 结构化审查报告(§4 模板),返回主对话
```

**禁止**:
- 在主对话内"模拟"SubAgent 审查
- 在 SubAgent prompt 中携带主对话的写作草稿或思考
- 使用同一个 SubAgent 连续审查多份 Plan(每份 Plan 必须新派 SubAgent)
- 使用 `Explore`(只读,无法输出结构化报告)
- 使用 `Plan`(产物是 plan 不是 review)
- 使用 `claude-code-guide`(领域不符)

### 3.2 SubAgent Prompt 模板

主对话必须按以下模板构造 SubAgent prompt(替换 `<...>` 占位符):

```text
你是 Figma Plan 自审 SubAgent。请独立、客观地审查以下 Plan 是否符合规范。

## 必读前置(强制,未完成则审查无效)
1. Read `D:\Project\figma-cli-rust\skills\figma-skill\references\plan-template.md` 全文
2. 重点关注 §3 Plan 文档结构 + §5 与 Spec 衔接检查表 + §8 Red Flags 11 条

## 待审 Plan
文件: <待审 Plan 文件绝对路径>
请 Read 该文件全文。

## 配套 Spec(必读,用于衔接检查)
文件: <配套 Spec 文件绝对路径>
请 Read 该文件全文。

## 审查任务
对照 plan-template.md §8 Red Flags 11 条,逐条打勾或打叉。
对照 plan-template.md §5 与 Spec 衔接检查表(7 项),逐项核对覆盖。
每条必须给出:
- 状态: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL
- 证据: 文件行号 + 引用文本片段(≤3 行) 或 缺失原因

## 输出格式(强制)
按 §4 报告模板输出,不得超出该结构。结尾必须给出 **总判定: PASS / FAIL** 与 1 句总评。

## 硬约束
- 不得修改任何文件
- 不得跳过 11 条中的任一条
- 不得复述 Plan 原文超过 5 行
- 发现红线情况立即 FAIL,不得打回修改
```

### 3.3 SubAgent 类型

固定使用 `general-purpose`(本仓库 subagent 类型表中的 catch-all)。

---

## 4. 审查报告模板(SubAgent 必填)

SubAgent 输出必须严格按下表结构,任何多余段落 / 缺失段落视为格式违规 → FAIL。

```markdown
# Plan 自审报告

**待审 Plan**: <文件绝对路径>
**配套 Spec**: <Spec 文件绝对路径 + 是否含 PASS 元数据>
**审查依据**: skills/figma-skill/references/plan-template.md §3 + §5 + §8
**审查者**: SubAgent(独立上下文)
**日期**: YYYY-MM-DD

---

## §8 Red Flags 12 条逐条对照

| # | 检查项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | 派生自未自审的 Spec | ✅/❌/⚠️ | <行号 + 引用或缺失> |
| 2 | 复述 Spec 原文 ≥ 3 行 | | |
| 3 | 含占位符(TBD / TODO / "之后再说" / "fill in") | | |
| 4 | 非白名单占位符(<背景色> <字号> <待补> 等) | | |
| 5 | Step 超时(>5 分钟未拆分) | | |
| 6 | 未引用 spec 行号(用"如 Spec 所述"代替 §X.Y) | | |
| 7 | 未含 FIGMA_DESIGN_SYSTEM.md 引用 | | |
| 8 | 任务类型与 Spec 不一致 | | |
| 9 | 含已废弃六字段门禁语言 | | |
| 10 | §4 失败处理章节为空或缺失 | | |
| 11 | 命令验收缺失:任一 Task 的 Step 序列无 `node check overlap` / `containment --recursive` / `page-overlap` 验收步骤,或裁剪检测未带 `--recursive` | | |
| 12 | 截图对象错位:任一 Task 的 Step 1.3 `figma-cli export node` 的 NODE_ID 不是该 Task 的 Atomic NodeId,而是 Section / Page / 父级 Frame | | |

---

## §5 与 Spec 衔接检查表(7 项)

| Spec 章节 | Plan 章节 | 覆盖确认 | 证据 |
|----------|----------|---------|------|
| §3.1 任务类型 + 执行顺序 | §3 Task 拆分顺序 | ✅/❌ | <行号 + 引用> |
| §3.4 三页结构位置 | §0 元信息 + §2 文件结构 | | |
| §3.5 复用审计 | §0 复用决策 + §3 各 Task `Reference` | | |
| §3.7 设计规范来源 | §1 全局约束 | | |
| §3.8 操作步骤 | §3 各 Task `Step X.Y` 命令 | | |
| §3.9 截图验收 | §3 各 Task `Test / Verify` | | |
| §3.10 失败停止条件 | §4 失败处理流程 | | |

---

## §3 Plan 文档结构完整性

| Plan 章节 | 存在 | 内容完整 |
|-----------|------|----------|
| §0 元信息 | ✅/❌ | ✅/❌ |
| §1 全局约束 | ✅/❌ | ✅/❌ |
| §2 文件结构预览 | ✅/❌ | ✅/❌ |
| §3 任务拆分(Task 数 ≥ 1) | ✅/❌ | ✅/❌ |
| §4 失败处理流程 | ✅/❌ | ✅/❌ |
| §5 自检清单 | ✅/❌ | ✅/❌ |

---

## 红线检查(任一命中即 FAIL)

- [ ] 不含 TBD / TODO / 占位符(白名单外)
- [ ] Plan 派生自 PASS 自审的 Spec
- [ ] 任务类型与 Spec 勾选一致
- [ ] 不复述 Spec 原文 ≥ 3 行
- [ ] 不含已废弃六字段门禁语言

---

## 总判定

**PASS / FAIL**

<一句话总评,不超过 50 字>
```

---

## 5. 主对话收到 SubAgent 报告后的处理流程

### 5.1 PASS 路径

```
SubAgent 报告 PASS
  → 主对话 Read 报告,确认 12 条全 ✅、红线全过、衔接表 7 项全过
  → 在 Plan 文件首部追加 1 行自审元数据:
    `<!-- self-reviewed-by: SubAgent, date: YYYY-MM-DD, verdict: PASS -->`
  → 进入 Step9(执行 Plan)
```

### 5.2 FAIL 路径(命中红线)

```
SubAgent 报告 FAIL(红线)
  → 主对话立即停止 Step9,进入自主修复
  → 就地修正所有红线条目(删除 TBD / 删除 / 补齐 Spec 元数据 / 删复述 / 删 v3 六字段)
  → 新派 SubAgent 重审(无轮次上限,见 §2 第 6 条)
  → 重审 PASS → 走 §5.1 流程进入 Step9
  → 主对话判定"修复已无方向 / 反复在同一处失败" → 向用户报告完整失败上下文
     (红线条目清单 + 已尝试修复的轮次与改动摘要 + 失败截图若有)
  → 禁止把红线条目抛回用户裁定"删除 / 改写 / 接受红线风险"
```

### 5.3 FAIL 路径(普通条目)

```
SubAgent 报告 FAIL(普通条目)
  → 主对话在原 Plan 上就地修复非红线条目
  → 必须新派 SubAgent 重审(无轮次上限,与红线共用 §2 第 6 条规则)
  → 主对话判定"修复已无方向 / 反复在同一处失败" → 视为规范未达,向用户报告完整失败上下文
```

---

## 6. Rationalization 表

主对话 / SubAgent 自审时必须主动规避以下误区:

| 误区 | 对应规范 | 正确做法 |
|------|---------|---------|
| "我自己写完自己审一下就行,不用 SubAgent" | §2 第 1 条 | 强制 SubAgent 独立审查,主对话自审一律无效 |
| "Plan 是 Spec 的延伸,不用单独审" | §2 第 1 条 | Plan 必须独立审,衔接表是核心 |
| "SubAgent prompt 里把 Plan 摘要带上更方便" | §3.2 prompt 模板 | prompt 只给文件路径,让 SubAgent 自己 Read |
| "我已检查,大致符合规范" | §2 第 3 条 | 必须 11 条逐条打勾,笼统回答一律 FAIL |
| "红线条目主对话先修一下再重审" | §5.2 | 红线 FAIL 由主对话就地自主修复 + 新派 SubAgent 重审(无轮次上限),禁止抛回用户裁定 |
| "审查报告复制了 Plan 原文好让用户看清楚" | §2 第 5 条 | 报告引用原文 ≤ 3 行,过长一律 FAIL |
| "同一个 SubAgent 连续审 3 份 Plan 提高效率" | §3.1 禁止条款 | 每份 Plan 必须新派 SubAgent,上下文隔离 |
| "红线是建议不是强制" | §2 第 4 条 + §4 红线检查 | 红线强制,任一命中立即 FAIL;但 FAIL 后由主对话就地修复 + 新派 SubAgent 重审,无轮次上限,而非抛回用户 |
| "Plan 引用 Spec 用'参见 Spec'就够了" | §8 第 6 条 | 必须用 `spec §X.Y 第 N 条` 形式 |
| "Task 缺命令验收步骤但靠截图也能验收" | §8 第 11 条 | 必须含 `node check overlap` / `containment --recursive` / `page-overlap` |
| "containment 不加 --recursive 直接子节点够用了" | §8 第 11 条 | 裁剪检测必须 `--recursive`,遍历 parent 每个后代对照最近 clipsContent 祖先边界做嵌套检查 |
| "截图直接截整个 Section 省事,组件在里面也能看到" | §8 第 12 条 | Step 1.3 `figma-cli export node` 的 NODE_ID 必须是该 Task 的 Atomic NodeId,Section 会带入无关组件,无法独立验收本 Task |

---

## 7. Red Flags

Plan 自审存在以下任一情况,主对话**立即停止当前 Plan 自审流程**,按 §5.1 / §5.2 / §5.3 自主处理(自主修复 + 新派 SubAgent 重审;非轮次原因判定无方向时再向用户报告完整失败上下文)——禁止把红线条目抛回用户裁定:

1. **无 SubAgent 审查**: 主对话跳过 SubAgent 派发,直接进入 Step9(违反 §2 第 1 条)
2. **SubAgent 未读 plan-template.md**: SubAgent 报告未引用 plan-template.md 任何章节 / 行号(违反 §2 第 2 条)
3. **审查报告缺条**: §8 11 条任一条状态为"未检查"或"跳过"(违反 §2 第 3 条)
4. **红线未拦截**: 报告中红线章节 5 项未全部勾选,但总判定仍为 PASS(违反 §2 第 4 条)
5. **冗余复述**: SubAgent 报告任一处复述 Plan 原文超过 5 行(违反 §2 第 5 条)
6. **主对话自审冒充**: SubAgent prompt 中携带主对话的写作草稿 / 思考过程(违反 §3.1 禁止条款)
7. **复用 SubAgent**: 同一 SubAgent 连续审查 ≥ 2 份 Plan(违反 §3.1 禁止条款)
8. **未配套 Spec 审查**: SubAgent 仅读 Plan 未读 Spec,衔接检查表全打 ✅ 但无引用证据(违反 §3.2 必读前置)
9. **衔接表全空**: §5 衔接检查表 7 项任何一项状态缺失或为 N/A(违反 §4 模板必填)
10. **红线 FAIL 抛回用户**: 红线 FAIL 后主对话未就地自主修复并重审,而是向用户发出"删除 / 改写 / 接受风险"的裁定请求(违反 §5.2)

---

## 8. 示例:SubAgent 报告(合规)

```markdown
# Plan 自审报告

**待审 Plan**: D:/Project/Nono/.figma/plans/2026-07-20-tooltip-pill.md
**配套 Spec**: D:/Project/Nono/.figma/specs/2026-07-20-tooltip-pill.md(已含 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->`)
**审查依据**: skills/figma-skill/references/plan-template.md §3 + §5 + §8
**审查者**: SubAgent(独立上下文)
**日期**: 2026-07-20

---

## §8 Red Flags 11 条逐条对照

| # | 检查项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | 派生自未自审的 Spec | ✅ | L1 含 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->` |
| 2 | 复述 Spec 原文 ≥ 3 行 | ✅ | L40-46 引用 spec §3.8 而非复述 |
| 3 | 含占位符 | ✅ | 全文无 TBD / TODO |
| ...(其余 8 条均已对照) | | | |

## §5 与 Spec 衔接检查表(7 项)

| Spec 章节 | Plan 章节 | 覆盖确认 | 证据 |
|----------|----------|---------|------|
| §3.1 任务类型 + 执行顺序 | §3 Task 拆分顺序 | ✅ | L30-35 顺序与 spec 一致 |
| ...(其余 6 项均已对照) | | | |

## §3 Plan 文档结构完整性

| Plan 章节 | 存在 | 内容完整 |
|-----------|------|----------|
| §0 元信息 | ✅ | ✅ |
| §1 全局约束 | ✅ | ✅ |
| §2 文件结构预览 | ✅ | ✅ |
| §3 任务拆分(3 Task) | ✅ | ✅ |
| §4 失败处理流程 | ✅ | ✅ |
| §5 自检清单 | ✅ | ✅ |

## 红线检查(任一命中即 FAIL)

- [x] 不含 TBD / TODO / 占位符
- [x] Plan 派生自 PASS 自审的 Spec
- [x] 任务类型与 Spec 勾选一致
- [x] 不复述 Spec 原文 ≥ 3 行
- [x] 不含已废弃六字段门禁语言

## 总判定

**PASS**

12 条全过,红线全清,衔接表 7 项全过,Plan 可进入 Step9。
```

---

## 9. 历史背景

本规范与 `review-spec.md` 同构,作为 Plan 自审的强制门禁落盘。在此之前 Plan 自审阶段依赖零散提示,Step8 仅在 SKILL.md 中以"强制加载 `references/review-plan.md`"一句带过,本次与 plan-template.md 同步落盘为独立规范。