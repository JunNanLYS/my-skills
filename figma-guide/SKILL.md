---
name: figma-guide
description: Figma 工程的统一入口 — 涵盖 MCP bridge(默认)、CLI(可独立安装的 @nono/figma-cli)、fork(.tools/figma-bridge-fork/)三种调用方式,以及坐标放置、token 强制、复合组件 6 大陷阱、export 验证、bounds 检测。触发条件:消息包含 Figma / figma / figma-cli / figma-bridge / NodeId 任一词时加载。不要被泛用动词(改/加/修/add/modify/fix)误触发。
version: 1.4
---

## 触发条件

仅当用户消息**包含 Figma / figma / figma-cli / figma-bridge / NodeId 任一词**(中英文不限)时执行本 Skill。

如果消息里没有这些词,即使涉及 UI / 颜色 / 组件,也**跳过**本 Skill —— 那可能是代码任务(Vue / React / Tailwind 等)。

## 调用方式总览

figma-guide 同时支持三种调用方式。前两种互相配合,第三种是 fork。**默认走 MCP bridge**。

| 方式 | 何时用 | 安装方式 | 详细章节 |
|---|---|---|---|
| **MCP bridge**(`mcp__figma-mcp-bridge__*`) | Claude 实时对话、交互式编辑 | Claude Code 配置里 `claude mcp add` 启动 server | §1 / §2 / §3 / §11 |
| **CLI**(`figma call <tool> --json '{...}'`) | 自动化、CI、可重放的批量任务 | **`npm install -g @nono/figma-cli`** — 见 §12.0 bootstrap | **§12**(install-first) |
| **fork**(`D:/Project/Nono/.tools/figma-bridge-fork/`) | 项目本地 fork 的 bridge,带 FigJam + Prototype 工具 | 同 MCP(只是 server 换),项目里 | **§13**(轻量速查,详细 runtime 约束见 fork/CLAUDE.md) |

> **三种方式互不冲突**(走同一个端口,默认 3055)。如果不确定装没装 CLI,先 `which figma` 或 `npx figma --list` 验证。

---

# Figma 设计编写规范

> 通用的 Figma 工程纪律。**项目专属的 token、文件 key、NodeId 不写在这里** —— 它们在项目自己的 docs 里。

---

## 1 · 工具选择

### 1.1 用 Figma MCP Bridge

所有节点操作(创建 / 修改 / 结构编辑 / 读取 / 导出)统一用 **`mcp__figma-mcp-bridge__*`** 工具族。

| 类别 | 工具 |
|---|---|
| 文档 | `figma_get_context` / `figma_list_pages` / `figma_server_info` |
| 节点读取 | `figma_get_nodes` / `figma_get_children` / `figma_search_nodes` |
| 创建 | `figma_create_frame` / `figma_create_rectangle` / `figma_create_ellipse` / `figma_create_text` / `figma_create_line` / `figma_create_component` / `figma_create_instance` / `figma_create_section` |
| 修改样式/属性 | `figma_set_fills` / `figma_set_strokes` / `figma_set_corner_radius` / `figma_set_effects` / `figma_set_opacity` / `figma_set_rotation` / `figma_set_text` / `figma_set_text_style` / `figma_set_auto_layout` / `figma_set_layout_align` / `figma_set_constraints` / `figma_set_variables` |
| 结构 | `figma_reparent_nodes` / `figma_delete_nodes` / `figma_clone_nodes` / `figma_group_nodes` / `figma_ungroup_nodes` / `figma_move_nodes` / `figma_resize_nodes` / `figma_set_selection` |
| 重命名 | `figma_rename_node` / `figma_rename_page` |
| 组件/属性 | `figma_swap_instance` / `figma_detach_instance` / `figma_combine_as_variants` / `figma_clone_nodes` |
| 导出/截图 | `figma_export_node` (PNG / SVG / JPG / PDF,可设 scale) |

> 全部读取也走 bridge,不再单独混用其他 MCP。`figma_get_context` 启动任务时一次拿到 fileId / fileName / currentPageId / currentPageName。

### 1.2 Bridge 能力边界

| 能力 | 可用 | 替代方案 |
|---|---|---|
| 新建独立 page | ✅(`figma_create_page`) | — |
| 删除 page | ✅(`figma_delete_page`) | — |
| 切换当前 page | ✅(`figma_set_current_page`) | — |
| 插入 SVG / vector 图标 | ❌(只能 create_line / create_rectangle / create_ellipse 等基础图元) | 用 Unicode 字符占位 (✏ / × / ⚠ / ▾ / − / ＋) 或 create_line 拼 |
| 修改既有 component 的 variants | ❌ | 视觉对齐即可,不强行改 component API |
| 一次性 move 到其他 page | ✅(`figma_move_to_page`) | — |

---

## 2 · 复用与组件 Page(强制)

### 2.1 必须有「组件」Page

每个 Figma 文件**必须**有一个独立的组件 Page(常见命名:`组件` / `Components` / `Library`),用来存放可复用的 Component / Instance / 多状态对照规范。

**首次进入文件时**(`§3.3` 拿到的 `pages` 列表)必须检查:

```
若 pages 中没有 name 匹配 /组件|Components|Library/i 的项:
  → AskUserQuestion 询问用户是否新建
  → 用户同意 → figma_create_page("组件") 自动建
  → 用户拒绝 → 允许本轮跳过,但 §2.2 复用纪律降级为"提醒"而非"强制"
```

### 2.2 复用纪律(强制)

**所有重复出现的视觉单元,优先复用,不重新创建**。常见复用场景:

| 场景 | 复用方法 |
|---|---|
| **导航栏 / 侧边栏 (NavBar / Sidebar)** | 在「组件」Page 定义为 Component → 每页 Instance 引用,改 active 态即可 |
| **标题栏 / 窗口头 (TitleBar)** | 在「组件」Page 定义为 Component → 每页 Instance 引用,改页面标题文字 |
| **页脚 / 状态栏 (Footer / StatusBar)** | 同上,Component + Instance |
| 列表/表格行 | `figma_clone_nodes` 复制行 frame,改内部文字/样式 |
| 卡片组(同类卡片 N 张) | 先建一张完整卡片,其余 `figma_clone_nodes` + 改文字 |
| 全局组件(按钮/Input/Pill 等) | 从「组件」Page 的 Component 派生 Instance,改 properties |
| 多状态对照(Button default/hover) | `figma_clone_nodes` 同一个 button frame 多次,逐个改样式 |

**页面级框架的特殊性**(导航栏/标题栏/页脚):

这些元素**每页都要出现**,但通常**只 copy 一次**(不像表格行会复制 N 次)。复用方式有两种:

```
A. 严格模式(推荐):
   在「组件」Page 创建 Component/Component Set
   → 每页用 Instance 引用,改 instance properties(active 态、标题文字)
   → 改 Component → 所有页面级 Instance 自动同步

B. 简化模式(Component 缺失时):
   第一页 figma_clone_nodes 完整复制一份
   → 后续每页 reparent + figma_set_text/figma_set_text_style 改文字
   → ⚠️ 风险:改一处样式要手动同步 N 页,容易漂移
```

**强烈推荐 A 模式**:导航栏/标题栏通常有 hover/active/disabled 等状态,且跨多页必须保持一致,用 Component Set 才能用 Properties 面板切换。

**操作节奏**:

```
1. 先 clone 一个完整样本(已有的同结构 frame)
2. 然后改文字 / 颜色 / 尺寸,不改结构层级
3. 最后 figma_get_nodes 验证坐标不重叠
```

**禁止**:

```diff
- ❌ 对每行/每张卡片从头 create_frame (结构重复定义 N 次,后续改一处要改 N 处)
- ❌ 凭印象重新画同结构组件(尺寸/间距/字体容易跑偏)
- ❌ 在 UI 设计页里"就地"创建 Component —— 应该先到组件 Page 定义,再到 UI 页 Instance
```

**例外**:

- 一次性临时元素(测试节点、占位符)不必复用
- 演示/截图任务中刻意要展示"独立组件"的场景,允许新建
- 用户明确说"重新画一张"时,听用户的

### 2.3 组件 Page 与 UI 设计页的关系

```
「组件」Page:
  - Component / Component Set 定义
  - 多状态对照规范(Section/01-99)
  - 全局样式预览
  ↓ 实例化
「UI 设计」Page:
  - Instance 引用,不重新定义组件
  - 仅在 Component 不存在时,fallback 到 clone 同结构 frame
```

> 设计原则:**组件在组件页定义一次,UI 页通过复用引用**。这样改组件 → 所有 Instance 同步更新,避免设计漂移。

---

## 3 · 坐标与放置规则

### 3.1 三条铁律

1. `figma_move_nodes` / 几何修改 的 `x/y` 是 **节点直接父容器的本地坐标**,**不是**页面绝对坐标。
2. `figma_create_*` 工具默认把新节点放到 **page root**。每次创建后必须**立即** `figma_reparent_nodes` 到目标父容器,再设置本地坐标。
3. 改几何优先用 `figma_resize_nodes` 或 `figma_move_nodes`,不要 delete + recreate —— 重建会丢样式,还会断引用。

### 3.2 标准操作节奏

```
创建节点 → figma_reparent_nodes 到目标父 → figma_move_nodes/resize_nodes 设本地 x/y/w/h
```

### 3.3 NodeId 纪律

- **不要凭记忆推断 NodeId** —— 每次重构 ID 都会变。
- 引用任何已有节点前必须 `figma_get_nodes` / `figma_get_children` 实测存在。
- 不要一次性批量创建 50+ 节点再验证 —— 中间错位难以回溯。
- `figma_search_nodes` 用 parentId 限定范围,避免全文档爆炸扫描。

### 3.4 复合组件 6 大陷阱(踩坑沉淀)

直接创建 / 改写 Component / Instance 时的 6 个高频坑,出自 Nono 设计实操:

| # | 陷阱 | 现象 | 应对 |
|---|---|---|---|
| 1 | **`clipsContent` 默认截断** | 子节点超出父框默认被裁掉 | 创建 frame 后立刻 `figma_get_nodes` 确认;如需可见,显式设 `clipsContent=false` |
| 2 | **ID 重映射** | 升 Component / 大改结构后所有子节点 ID 重新生成 | 重构后**重新** `figma_get_nodes` 拿新 ID,缓存的旧 ID 全部作废 |
| 3 | **Instance 只读** | 改不了子节点属性,只能改 instance 暴露的 properties | 改样式走 `figma_swap_instance` 换组件 / `figma_detach_instance` 拆掉改 / 改 master 让 instance 同步 |
| 4 | **升 Component 是快照** | 升完 Component 后再改 master,instance **不会**自动同步 | 升 Component 前**确认结构和样式都对**;升完后悔只能 detach 重做 |
| 5 | **不扩容父框** | 内容多了 → 组件宽度/高度自动撑开,破坏栅格 | 改父框尺寸用 §9 `figma-resize.mjs` 重算子节点,不能让子节点硬撑父框 |
| 6 | **文字 auto-resize 不一致** | 文字节点 `textAutoResize` 默认行为不一致(HEIGHT / WIDTH_AND_HEIGHT / NONE),容易撑破布局 | 长文本统一 `textAutoResize="HEIGHT"`(固定宽度,纵向自动);行数不可控时用 NONE + 手动截断 |

**操作纪律**:

- 升 Component 之前 → 先把所有子节点样式、autolayout、文字 autoresize 都调好,再升。升完就不再改了。
- 改父框 w/h 之前 → 先用 §10 `figma-validate-bounds.mjs` 扫一遍当前越界情况,知道"修之前"基线。
- 改完父框 w/h 之后 → **必须**再跑一次 §10,确认 exit=0 才算通过。

---

## 4 · 获取 Page 与文件结构

**写 Figma 之前必须先摸清文件结构**。Bridge 的 `figma_create_*` 默认落到 page root,但你必须先知道**当前文件有几个 page、各自 NodeId 是什么**。

**核心原则**:**只在首次获取并缓存**;后续 session 直接读缓存,跳过 `figma_list_pages`。

### 4.1 缓存位置

```
<当前项目根>/.figma/state.json
```

格式:

```json
{
  "fileId": "unknown",
  "fileName": "Nono",
  "currentPageId": "0:1",
  "currentPageName": "UI设计",
  "pages": [
    { "id": "0:1", "name": "UI设计" },
    { "id": "127:771", "name": "组件" }
  ],
  "updatedAt": "2026-06-28T12:00:00Z"
}
```

> 注意:实际 `figma_get_context` 拿到的 fileId 字段是 `fileId`(在 documentInfo 里),旧版本可能叫 fileKey —— 缓存时统一存 `fileId`。

### 4.2 流程:是否首次

```
每次开始 Figma 任务时:
  1. 用 Bash + ls 检查 <项目根>/.figma/state.json 是否存在
     - ls -la <项目根>/.figma/state.json 2>/dev/null
  2. 若存在 → 用 Read 工具读出 fileId + pages,跳到 §4.4 选定 page 阶段
  3. 若不存在 → 走首次流程 §4.3
```

### 4.3 首次流程

```
第 1 步:确认文件身份 + 当前页
  mcp__figma-mcp-bridge__figma_get_context
  → 返回 {version, connected, documentInfo: {fileId, fileName, currentPageId, currentPageName, editorType}}

第 2 步:列出所有 page
  mcp__figma-mcp-bridge__figma_list_pages
  → 返回 [{id, name, isCurrent}]

第 3 步:写入缓存
  mkdir -p <项目根>/.figma        (Bash,一次性)
  Write(
    file_path=<项目根>/.figma/state.json,
    content=按 §4.1 格式的 JSON,
  )

第 4 步:继续 §4.4
```

### 4.4 选定 page 后扫内容

无论是否首次,都要做这一步(获取的是 page 内部节点,不在缓存范围内):

```
  mcp__figma-mcp-bridge__figma_get_children(parentId=<pageId>, depth="compact")
  → 返回该 page 的直接子节点列表

  需要更深的子树:
  mcp__figma-mcp-bridge__figma_get_nodes(nodeIds=[<id>], depth="compact")

  按名字搜索:
  mcp__figma-mcp-bridge__figma_search_nodes(parentId=<scope>, nameContains="...")
```

### 4.5 何时刷新缓存

以下情况**必须**重新跑 §4.3 并覆盖 `state.json`:

- 用户说"换了个 Figma 文件" / "新文件"
- `figma_get_context` 返回的 `fileId` 与缓存里不一致
- 用户重命名了 page
- 用户新增/删除了 page(用 `figma_create_page` / `figma_delete_page` 后)

Page ID 不变(参见 §4.6)的情况下,**不要**主动刷新缓存。

### 4.6 关键提示

- **多文件场景必须传 fileId** —— 当前项目如果只连了一个 Figma 文件,大多数 Bridge 工具可以省略 fileId,但 `figma_get_context` 仍是确认手段。
- **Page ID 是稳定的** —— Page 是文件级结构,只要不删/不重命名,PageId(`0:1` / `127:771` 这种)不会变。缓存命中后 PageId 可以**直接复用**,不用每次重新 list_pages。
- **Section / 子节点 ID 不稳** —— 经过大重构(reparent / merge / clone / delete+recreate)后 Figma 会重分配局部 ID,**必须**每次实测,不能从对话历史/summary/截图里抄。
- **当前激活页** = `currentPageId`,默认编辑操作落到这里;要写其他 page 必须 `figma_set_current_page` 或显式 reparent 到目标 page。
- **缓存不是 session 启动时加载的** —— Skill 是触发式(消息里出现 "Figma" 才加载),所以"首次获取"指的是**首次 Figma 任务**,不是 session 启动。

---

## 5 · Token 强制(通用)

### 5.1 Token 的归属

本 Skill **不**硬编码任何色值、字号阶梯、间距、圆角、阴影、动效。这些信息在项目自己的设计系统文档里(常见的叫法:`docs/DesignSystem.md` / `design-tokens.json` / 等价物)。遇到不确定的颜色,先去查项目 doc,查不到**问用户**。

**禁止**:凭印象硬编码色号(比如把 primary 写成 `#2563EB`)。每个项目的 primary 都不同,写错就污染整个设计。

**Figma 变量优先**:Figma 自带的 Variables 体系(`figma_get_local_variables` / `figma_search_variables`)是项目 token 的权威源 —— 改色前先 `figma_search_variables(nameContains="primary")`,找到后再 `figma_apply_style` 或直接用 `figma_set_fills` 引用变量。

### 5.2 常见坑

- 价格/百分比/数字一律开 `font-variant-numeric: tabular-nums` 对齐。
- Pill 形组件(radius 999)在 Apple 风格 UI 里很常见 —— 先确认项目是否要求。
- 焦点环通常用 `shadow-glow` 模式(如 `0 0 0 4px rgba(primary, 0.12)`)。
- 任何红/绿/橙/黄的使用前,确认项目 doc 里是否有语义限制(涨跌专用、警示专用、禁用等)。

---

## 6 · Section / 区域模式(通用)

大多数设计系统页把参考内容组织成 Section。**新增 Section 前**先用 §4 的方法定位目标 page,再扫描既有 Section,提取模式:

1. `figma_get_children(parentId=<pageId>, depth="compact")` 拿到目标 page 的节点树。
2. 扫描兄弟 Section,提取:宽 / 高 / 描边 / 圆角 / 标题样式 / 副标题样式 / 内容区起点。
3. 新 Section **严格复刻**这个模式。

**不要假设 Section 是固定像素尺寸** —— 永远从兄弟节点测量出来。

---

## 7 · 验证三步法

每个任务完成后:

1. **代码层** —— `figma_get_nodes` / `figma_search_nodes` 验证关键节点存在且坐标正确。
2. **视觉层** —— `figma_export_node` 导出 PNG(scale=2)。
3. **业务层** —— Read 截图目视确认无重叠 / 裁切 / 色差。

### 7.0 截图必 Read(强制)

**`figma_export_node` 返回成功 ≠ 渲染正确**。工具返回 base64 不代表 UI 视觉上没问题 —— 实际渲染中常见的"看不见的错":

- 文字被裁(autoresize 算错高度)
- 颜色用错(变量未绑定,落到 fallback)
- 节点被覆盖(z-order 错)
- Instance overrides 没生效(master 改了但 instance 没刷)

**强制规则**:

```diff
+ ✅ 每次 figma_export_node 后,必须用 Read 工具打开截图 PNG
+ ✅ 重点核对:文字完整可见 / 颜色与设计稿一致 / 无遮挡 / 无 1px 错位
+ ✅ Read 完才能向用户报告"已完成"
+ ✅ Read 发现问题 → 回到代码层定位,不要硬调

- ❌ 截图工具返回成功就宣布完成(等同于没做验证)
- ❌ 只看 base64 大小判断"导出正常"(大小不能反映渲染正确性)
- ❌ 在 Read 之前向用户承诺视觉效果
```

**Read 截图时的速查清单**:

- [ ] 文字是否完整(无 ... 截断、被裁、超框)
- [ ] 颜色是否匹配(尤其语义色:绿涨红跌 / 警示 / 禁用)
- [ ] 元素是否有重叠或被遮挡
- [ ] 间距是否均匀(尤其列表行 / 卡片组)
- [ ] 圆角 / 描边 / 阴影是否符合项目 token
- [ ] 父框与子节点是否对齐(左对齐 / 居中 / 右对齐)
- [ ] 复合组件的实例 overrides 是否生效(master 改后 instance 是否同步)

### 7.1 截图路径原则

推荐 `<项目根>/temp/figma/` —— **必须先 `mkdir -p`**,否则 `figma_export_node` 返回的 base64 需要自己写盘(本工具直接返 base64,不写文件)。

**实际操作**:

```
figma_export_node(nodeId=<id>, format="PNG", scale=2)
→ 返回 { base64, format, scale }
→ Claude 用 Read 工具或脚本解码到 <项目根>/temp/figma/{page-name}-{feature}.png
```

**base64 写盘示例**(Python):

```python
import base64, pathlib
pathlib.Path("<项目根>/temp/figma").mkdir(parents=True, exist_ok=True)
out = pathlib.Path(f"<项目根>/temp/figma/{name}.png")
out.write_bytes(base64.b64decode(<base64 string>))
```

> 写盘后**必须** `Read file_path=<png>` 打开,目视核对(见 §7.0)。
> 已有可复用脚本的项目(如 `D:/Project/Nono/temp/decode_*.py`)优先复用,不必每次手写。

> 与旧版 `save_screenshots` 不同,**单次调用只导一个节点**。需要多个截图时,逐个调用 `figma_export_node`,然后自己汇总到目录。

### 7.2 保存前检查

- 首次保存前 `mkdir -p` 目标目录。
- 重新导出时 `rm -f` 旧文件,避免读到旧图。

### 7.3 `figma-save-export.mjs` —— base64 → PNG 写盘助手

`figma_export_node` 返回的 `data` 字段是 base64 PNG 字符串,工具自身**不写盘**。每次手写 `base64.b64decode` + `writeFileSync` 既啰嗦又容易漏 magic 校验。本脚本封装**校验 + 写盘**两步。

**工具位置**:`D:/ai-skills/figma-guide/scripts/figma-save-export.mjs`

> `~/.claude/skills/figma-guide/scripts/` 是 `sync-skills` 维护的同一份镜像;**日常改动只改源仓库**,然后 `sync-skills` 同步。

**三种入参方式**:

```bash
# A. 命令行参数(短 base64 推荐)
node figma-save-export.mjs --base64 "<data>" --out <absDir> [--name <file.png>]

# B. stdin(长 base64,避免命令行长度溢出)
echo "<data>" | node figma-save-export.mjs --stdin --out <absDir> [--name <file.png>]

# C. JSON 文件(适合 tool result 直接 dump 到文件)
node figma-save-export.mjs --in <result.json> --out <absDir> [--name <file.png>]
```

**关键行为**:

| 项 | 行为 |
|---|---|
| `--name` 缺省 | `figma-export-{YYYYMMDD-HHMMSS}-{random4}.png` |
| 自动补 `.png` 后缀 | 是 |
| 同名文件 | 默认拒绝(`exit 3`),传 `--overwrite` 允许 |
| PNG magic 校验 | 强制(`89 50 4E 47 0D 0A 1A 0A`),非 PNG `exit 4` |
| 自动 `mkdir -p` | 是 |
| 输出 | JSON `{success, path, name, bytes, sha256_prefix}` 到 stdout |

**退出码**:

| Code | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 参数错误(三选一来源未指定 / 缺 `--out`) |
| 2 | base64 解码失败 / 解码后为空 |
| 3 | 文件已存在且未传 `--overwrite` |
| 4 | PNG magic 校验失败(给的不是 PNG) |

**Claude 完整工作流**:

```
1. mcp__figma-mcp-bridge__figma_export_node(nodeId, format="PNG", scale=2)
   → 拿到 { data: "<base64>", format, scale, size, success }

2. echo "<data>" | node <skill>/scripts/figma-save-export.mjs --stdin --out <项目根>/temp/figma --name 791-479-homepage.png
   → 拿 JSON: { success, path, bytes, sha256_prefix }

3. Read file_path=<path>     ← §7.0 强制,不能省
   → 目视核对文字/颜色/对齐

4. 向用户报告"已 Read 截图,确认 X / Y / Z"
```

**反例**:

```diff
- ❌ 跳过 PNG magic 校验直接写盘(给错 data 会落一个伪 PNG,Read 时一脸懵)
- ❌ 每次都手写 `base64.b64decode` + `writeFileSync`(违反 §8.1 批量 + §7.3 复用)
- ❌ 不传 `--name` 又不复用 random 后缀,导致多次截图互相覆盖
- ❌ 把 base64 直接塞 `Write` 工具的 file_path(Write 写文本,PNG 是二进制会坏)
```

---

## 8 · 批量操作

### 8.1 必须批量

- `figma_export_node` —— 多个节点多次调用,但**同一次对话内连续发**,不要插入无关操作
- `figma_delete_nodes` —— 一次调用传多个 ID
- `figma_reparent_nodes` —— 同来源多个 ID 一次调用
- `figma_clone_nodes` —— 同来源多个 ID 一次调用
- `figma_resize_nodes` —— 一次调用传多个 ID

### 8.2 必须串行

- 创建 → reparent → 设坐标(单节点一步一步走)
- 同帧内的多层结构(框架 → 标题 → 内容 → 样式,逐层)

### 8.3 反例

```diff
- ❌ 一次性创建 50+ 节点再统一验证(中间错位会级联)
- ❌ figma_move_nodes 在 reparent 之前(被算成 page-root 偏移)
- ❌ 凭记忆推断 NodeId(每次重构都会变)
- ❌ 删了重建来"修"几何(丢样式和引用)
```

---

## 9 · 复合组件 resize 助手(`scripts/figma-resize.mjs`)

### 9.1 为什么需要

`figma_resize_nodes` 只改父节点 `w/h`,**不动子节点**。子节点坐标是绝对的,父框缩小时右边/下边子节点被裁,放大时空出。Figma 的 `figma_set_constraints` 需要预先在每个子节点上设置,事后靠 MCP 改不回。

AI 心算缩放坐标也容易差 1-2px,累积下来肉眼可见的错位。

### 9.2 工具位置

`D:/ai-skills/figma-guide/scripts/figma-resize.mjs`

> `~/.claude/skills/figma-guide/scripts/` 是 `sync-skills` 维护的同一份镜像;**日常改动只改源仓库**,然后 `sync-skills` 同步。

### 9.3 三种重算模式

| Mode | 语义 | 适用场景 |
|---|---|---|
| **`center`** | 子节点相对父中心保持,旧中心距离按比例映射到新父框 | 父框均匀缩小,子节点同向居中 |
| **`scale`** | 子节点 `x/y/w/h` 全部按 `rx = newW/oldW, ry = newH/oldH` 等比缩放 | 父框缩放后子节点也要同比缩放(图标、卡片) |
| **`anchor`** | 锚点位置不动,其余子节点按比例重新分布 | 父框只改一边(如 tab 容器加宽)、其余 pin |

### 9.4 调用约定

**Claude 不直接执行脚本,而是**:

1. 用 `figma_get_nodes` 拿父 + 子节点当前 `x/y/w/h`
2. 组装 `--config` JSON(见下)
3. `node figma-resize.mjs <parentNodeId> --config <json>` → 拿到每个子节点的 `{x, y, w, h}` plan
4. 用 `figma_move_nodes` / `figma_resize_nodes` 批量下发新坐标
5. (可选) `figma_export_node` 截图核对

> 脚本**不**直接调 MCP — 留给 Claude 侧执行,本脚本只做纯计算 + dry-run 校验。

### 9.5 config 格式

```jsonc
{
  "parent":   { "x":0, "y":0, "w":360, "h":40 },   // resize 前的父框(从 get_nodes 拿)
  "newW": 300, "newH": 40,                        // resize 后的目标尺寸
  "mode": "center",                               // center | scale | anchor
  "anchor": "tl",                                 // anchor 模式生效:tl/t/tr/l/c/r/bl/b/br
  "children": [
    { "id":"47:239", "x":14, "y":8, "w":32, "h":24, "constraints":"tl" }
    //   ↑ constraints 写法遵循 Figma:tl/pin 左上; scale/等比缩放; 不写默认 tl
  ]
}
```

输出 plan 字段:

```json
{
  "nodeId": "47:212",
  "ratio": { "rx": 0.833, "ry": 1.25 },
  "plan": [
    {
      "id": "47:239",
      "from": { "x":14, "y":8,  "w":32, "h":24 },
      "to":   { "x":12, "y":10, "w":27, "h":30 },
      "delta":{ "dx":-2, "dy":2, "dw":-5, "dh":6 },
      "warnings": []
    }
  ]
}
```

### 9.6 行为保证

- 所有计算 `Math.round`,统一像素精度
- `clamp` 防止子节点超出新父框,贴边处理
- 超出时 `warnings` 列出具体超出哪边,**exit code 2**(区别于正常 0)
- 不读状态文件、不写文件 — 纯函数,无副作用

### 9.7 反例

```diff
- ❌ 对每个子节点凭印象算新坐标(差 1-2px 累积成肉眼可见的错位)
- ❌ 改父框后批量 figma_resize_nodes 不算子节点(裁切/溢出)
- ❌ 用 delete + recreate "修"几何(丢样式和引用,见 §3.3)
```

---

## 10 · 子组件越界检测器(`scripts/figma-validate-bounds.mjs`)

### 10.1 为什么需要

复合组件(尤其 auto-layout 失效后的 fallback 布局)中,经常出现:
- 子节点被父框裁掉一部分(右/下溢出)
- 子节点"出框"飘在父框外(左/上溢出)
- 改一个父框 w/h 后,内部绝对定位的子节点没跟着动

肉眼难一眼看出来,尤其深嵌套几层后。本脚本递归遍历整棵子树,直接报出每个违规的 `parentId / childId / side / overflow 像素`。

### 10.2 工具位置

`D:/ai-skills/figma-guide/scripts/figma-validate-bounds.mjs`

> `~/.claude/skills/figma-guide/scripts/` 是 `sync-skills` 维护的同一份镜像;**日常改动只改源仓库**,然后 `sync-skills` 同步。

### 10.3 检测规则

对每个 parent-child 对:
- `child.x < 0` → left 溢出 `|child.x|` px
- `child.y < 0` → top 溢出 `|child.y|` px
- `child.x + child.w > parent.w` → right 溢出 `child.x + child.w - parent.w` px
- `child.y + child.h > parent.h` → bottom 溢出 `child.y + child.h - parent.h` px

**坐标系约定**:Figma REST API 默认返回 `x/y` 是**相对父的局部坐标**,所以比较时父参考原点视为 (0, 0),**不**累加祖父层偏移。

### 10.4 默认行为

- `clipsContent=true` 的父节点 → 子节点溢出**忽略**(设计意图就是裁,例如头像框)
- 容差 0(整数像素,不该有浮点误差)

`--strict` 把 `clipsContent=true` 也算违规。`--tolerance N` 把容差放宽 N px(对付历史脏数据)。

### 10.5 调用约定

**Claude 不直接执行脚本,而是**:

1. 用 `figma_get_nodes` 递归拿根节点的子树(可多次调用 + 拼装 JSON),`depth="full"` 拿到所有子节点
2. 把节点的 `x/y/w/h/clipsContent` + `children: [id, id, ...]` 装进 `--config`(递归树)或 `--figma-json`(id 平铺字典,见 §10.5b)
3. `node figma-validate-bounds.mjs <rootNodeId> --config <json>` 或 `--figma-json <json>` 拿 violations 列表
4. 据此决定:用 §9 `figma-resize` 重算子节点坐标 / 扩父框 / 改 clipsContent

### 10.5a config 格式(递归树,旧版)

```jsonc
{
  "root": {
    "id": "47:212",
    "x": 0, "y": 0, "w": 360, "h": 40,         // 根节点 bounds
    "clipsContent": false,                      // 可选
    "children": [                               // 递归子树,内嵌完整节点
      {
        "id": "47:239", "x": 14, "y": 8, "w": 32, "h": 24,
        "clipsContent": false,
        "children": []
      }
    ]
  }
}
```

**缺点**:Claude 要手工把 Figma 树转成嵌套结构,3 层以上容易丢层或拼错。

### 10.5b figma-json 格式(id 平铺字典,推荐)

```jsonc
{
  "rootId": "47:212",
  "nodes": {
    "47:212": { "id": "47:212", "x": 0, "y": 0, "w": 360, "h": 40, "clipsContent": false, "children": ["47:239", "47:300"] },
    "47:239": { "id": "47:239", "x": 14, "y": 8, "w": 32, "h": 24, "clipsContent": false, "children": [] },
    "47:300": { "id": "47:300", "x": 100, "y": 50, "w": 200, "h": 30, "clipsContent": false, "children": [] }
    //  ↑ children 只放 id 数组,不是嵌套对象
  }
}
```

**优点**:
- 平铺 id 索引,直接对应 `figma_get_nodes` 返回格式,Claude 把多个节点结果塞进 `nodes: {...}` 字典即可,无需手工拼嵌套树
- 缺节点警告但不报错(单个坏引用不会让整棵树挂掉)
- `rootId` 缺失时用 CLI 第一参数 `<rootNodeId>`,二者不一致只警告

**拼装流程**:

```
第 1 步:figma_get_nodes(nodeIds=[<rootId>], depth="full")   可能拿不全
第 2 步:补 figma_get_nodes(missingChildIds)               直到拿全
第 3 步:把每个节点 {id, x, y, w, h, clipsContent, children} 直接塞 nodes[id]
        children 数组里只放子节点 id,不放对象
第 4 步:写文件 / 传 inline 给 --figma-json
```

> `clipsContent` 字段 `figma_get_nodes` 默认不返回,需要 `depth="full"` 或单独查;省略则默认 `false`。

### 10.6 输出

```json
{
  "rootId": "47:212",
  "summary": { "nodesVisited": 11, "violations": 3, "parentsWithIssues": 2 },
  "violations": [
    {
      "parentId": "47:212", "parentName": "PageHeader",
      "childId": "47:300",  "childName": "TabBar",
      "childType": "FRAME",
      "issues": [{ "side": "bottom", "overflow": 101, "childBox": {...}, "parentBox": {...} }]
    }
  ],
  "tree": { /* 整棵递归树,violations 字段填在每个 parent 节点上 */ }
}
```

退出码:
- **0**:全部通过
- **1**:有违规(便于 CI 串联)
- **2**:参数错误

### 10.7 反例

```diff
- ❌ 只看 root 节点的 bounds(看不到深嵌套子节点溢出)
- ❌ 凭"截图看着像没事"主观判断(子节点溢出 1-2px 肉眼难辨)
- ❌ 递归写循环忘了 clipsContent(把"故意裁切"误报成违规)
- ❌ 拼 --config 时手工嵌套 children 写错层级或漏节点(改用 --figma-json 平铺,避免人为拼树)
```

---

## 11 · 完工前自检清单

- [ ] 全程使用 `mcp__figma-mcp-bridge__*` 工具,未混用其他 MCP
- [ ] 每个 `figma_create_*` 之后立刻 `figma_reparent_nodes` + 本地坐标
- [ ] 关键节点均通过 `figma_get_nodes` / `figma_get_children` 验证,未凭记忆推断 NodeId
- [ ] 重复结构(列表行/同型卡片)优先 `figma_clone_nodes`,未从头 create
- [ ] 组件 Page 存在,通用组件(Component)在组件页定义一次,UI 页用 Instance 引用
- [ ] 导航栏 / 标题栏 / 页脚等页面级框架,在组件页定义为 Component,每页用 Instance 引用(而非裸 clone)
- [ ] 颜色 / 字号 / 圆角 / 间距匹配项目设计系统文档(优先用 Figma Variables 引用,不硬编码色号)
- [ ] 新 Section 复刻既有 Section 模式(从测量得来,不假设)
- [ ] 截图保存到 `<项目根>/temp/figma/`,scale=2,格式 PNG
- [ ] 截图 Read 目视确认无重叠 / 裁切 / 色差 / 遮挡
- [ ] 未擅自修改或删除项目已交付的内容
- [ ] **改动任何复合组件父框 `w/h` 后,运行 §10 `figma-validate-bounds.mjs` 验证子树无越界(exit=0 才算通过)**
- [ ] **越界违规存在时,运行 §9 `figma-resize.mjs` 重算子节点坐标,再下发 `figma_move_nodes` / `figma_resize_nodes` — 不要凭印象算**
- [ ] **升 Component 之前确认结构和样式都对**(升完是快照,instance 不会自动同步,见 §3.4 #4)
- [ ] **改 Instance 子样式前确认走 swap / detach / master 三选一**,不强行改只读属性(见 §3.4 #3)
- [ ] **文字节点固定 `textAutoResize="HEIGHT"` 或 NONE**,不让 WIDTH_AND_HEIGHT 自动撑破布局(见 §3.4 #6)
- [ ] **截图 Read 核对视觉效果** —— 不只信 `figma_export_node` 返回成功(见 §7.0)
- [ ] **base64 写盘用 §7.3 `figma-save-export.mjs`**,不手写 `base64.b64decode`(magic 校验 + 默认拒绝覆盖是脚本保证的,手写易漏)
- [ ] **若使用 CLI(§12):先 `call figma_get_context --json '{}'` 确认 bridge 连接(exit=0 && `ok:true`);用 canonical `call` + `--json` 形式,不走 short form 传嵌套对象;长 JSON 用 `--json-file` 走文件**
- [ ] **若使用 fork-only 工具(§13,如 prototype reactions):先查 `.tools/figma-bridge-fork/CLAUDE.md` 拿 runtime 约束,不要凭印象写;URL / OVERLAY / matchLayers / SCROLL_TO 都有限制(见 fork/CLAUDE.md 31-35 条)**
- [ ] **跨项目用 CLI 时确认端口**:默认 3055;若改端口用 `FIGMA_BRIDGE_PORT=3057` 或 `--port 3057` 显式传

---

## 12 · Figma CLI(可独立发布的 `@nono/figma-cli`)

### 12.0 Bootstrap — 从零装起来

**给别人 / 给自己换台机器** 都按这 4 步装。**当前用户**(就是 Nono 项目本地用)跳到 §12.1 看怎么调,但 §12.0 留着做"上手指引"。

#### Step 1 · 前置依赖

| 依赖 | 版本 | 验证命令 |
|---|---|---|
| Node.js | ≥ 18.0(实测 24.13.0 / 包要 `engines.node: ">=18"`) | `node --version` |
| npm | ≥ 9(随 Node.js 一起装) | `npm --version` |
| Figma 桌面 | 最新版(运行在 macOS / Windows / Linux) | 在 desktop 装 Claude Bridge plugin |
| Figma plugin "Claude Bridge" | fork 或 upstream 任一 | plugin UI 里启一个 WS server,默认端口 3055 |
| `@magic-spells/figma-mcp-bridge` | ≥ 0.3.0 | 由 CLI 自动拉,不用单独装 |

#### Step 2 · 安装 CLI(3 种任选)

```bash
# A. 从 npm(发布后)
npm install -g @nono/figma-cli
# → `figma` 进 PATH

# B. 从 GitHub 仓库(npm publish 之前)
git clone https://github.com/JunNanLYS/figma-cli
cd figma-cli && npm install
# 二进制在 ./node_modules/.bin/figma 或 ./cli.js

# C. 从本地 tarball(本地测试用)
npm pack          # 在 figma-cli 目录里
npm install -g ./nono-figma-cli-0.1.0.tgz
```

#### Step 3 · 启动 bridge server

CLI 不会自己起 bridge server,**它只是个 client**。需要同时跑:

```bash
# 上游默认端口 3055
npx @magic-spells/figma-mcp-bridge

# 或 fork(本项目,用 .tools/figma-bridge-fork/)
node D:/Project/Nono/.tools/figma-bridge-fork/src/index.js
# 端口可在 Figma plugin UI 里改(默认 3055)
```

> 不启动 bridge 就跑 CLI,第一步 `figma_get_context` 会返回 `connected: false`(exit=0 但 ok:true)— 不是 bug,是「plugin 未连接」的提示。

#### Step 4 · 验证

```bash
which figma                    # 装了应该指向 npm 全局 bin
figma --list | head            # 34 个工具的清单
figma call figma_get_context --json '{}'
# → "ok": true, "data": { "connected": true|false, ... }
```

如果 `which figma` 没输出,说明 npm 全局 bin 不在 PATH:

```bash
npm config get prefix                    # 找 global prefix
# Windows 默认: C:\Users\<you>\AppData\Roaming\npm
# 把 <prefix>/bin 加到 PATH(Windows: <prefix> 也加,因为 .cmd 在 prefix 根)
```

#### 已知坑

| 坑 | 表现 | 解决 |
|---|---|---|
| `node: bad option` | 装了 Windows Microsoft Store 的 node alias | 用 `nvm` / `scoop` / 官网 installer,不用 Store 版 |
| `figma: command not found` | npm global bin 不在 PATH | 见 Step 4 末尾 |
| `figma` 在 PATH 但版本不是 0.1.0 | 老的本地副本仍在 PATH 里 | `which -a figma` 看所有位置,改 PATH 顺序 |
| 端口 3055 被占 | stderr 出现 `[FigmaBridge] Port 3055 in use, trying 3056` | 这其实是 fallback,**不是错**;Figma plugin UI 改同端口就好 |

#### 反例

```diff
- ❌ 跳过 Step 3 起 bridge server,直接调 CLI(得到 connected:false 还以为 CLI 坏了)
- ❌ 用 Microsoft Store 的 Node.js(它 `node` 是 stub,要装官网版或 nvm)
- ❌ npm install -g 后 `figma --list` 报 "command not found"(没把 prefix/bin 加到 PATH)
- ❌ 把 npmm 全局 bin 当用户 bin 写权限失败(npm config set prefix 改到 ~/.npm-global)

---

### 12.1 它是什么 + 何时用

`@nono/figma-cli` 是 figma-bridge 的 **CLI 包装器**:把 `mcp__figma-mcp-bridge__*` **34 个工具**接出来,每条命令 stdin/stdout 都是单 JSON 文档。

| 场景 | 走 MCP 还是 CLI |
|---|---|
| Claude 实时交互对话 | **MCP bridge**(流式、可见) |
| 写脚本一次性批量(导出 N 张图,改 N 个节点) | **CLI**(可重放,可跑 CI) |
| CI / 自动化 | **CLI**(MCP 不在 headless 环境) |
| 调试 / 手测一次 | CLI short form + `--list` |
| fork-only 工具(prototype reactions / flow starting points) | 仍走 MCP bridge(server 换 fork) |
| Claude 想把结果再读回上下文 | **MCP**(CLI 输出要再 `Read` JSON 文件才能看) |

> 默认装完 CLI 就已经能用 —— **不需要**再 clone 项目仓库的 `.tools/figma-cli/`。本机原来的副本可以保留也可以删除,§12.2 的命令对两份都通(命令行相同)。

### 12.2 调用约定

> **3 种形式:已 publish → `figma`;本地 tarball → `npx figma`;本地仓库 → node 路径**

```bash
# 形式 A(已装 CLI):全局命令 `figma` —— 已 publish / npm install -g 后用这条
figma call figma_get_context --json '{}'
figma call figma_create_rectangle --json '{"x":100,"y":100,"width":50,"height":50,"parentId":"0:1","fills":{"color":"#FF0000"}}'

# 形式 B(用 npx,不依赖全局 PATH)
npx -y @nono/figma-cli call figma_get_context --json '{}'

# 形式 C(从 Nono 项目本地仓库,未 publish 阶段)
node D:/Project/Nono/.tools/figma-cli/cli.js call figma_get_context --json '{}'

# short form(人类手测友好,每个工具一个子命令)
figma figma_list_pages

# 长 JSON 走文件,避免命令行溢出
figma call figma_export_node --json-file ./args.json

# 跨端口(默认 3055;bridge 端用 -p <port>,client 端用 FIGMA_BRIDGE_PORT)
FIGMA_BRIDGE_PORT=3057 figma call figma_list_pages --json '{}'

# 端口被占用时,FigmaBridge 自动尝试下一个空闲端口(3055→3056→…)
# 看 stderr 的 "[FigmaBridge] Port N in use, trying N+1" 知道当前会话用的是哪个

# 列出所有工具(34 个,带 description + input JSON Schema)
figma --list
figma list
```

> **A / B / C 三种形式指向同一份代码**。改 CLI 就改 `@nono/figma-cli` 仓库,pull 后重 `npm install -g` 或跑 `npx -y`。

### 12.3 I/O 契约(单一 JSON)

```
stdout: 永远是 1 个 JSON 文档(成功 payload 或 error envelope)
stderr: bridge 日志 + CLI usage hints,不污染 stdout
exit code:
  0  成功
  1  CLI/参数错误(bad JSON / 缺 required / 未知 tool)
  2  bridge/business 错误(Figma 返回 error / NOT_CONNECTED 等业务错)
  3  transport 错误(超时 / 连接断开)
```

成功 envelope:

```json
{
  "ok": true,
  "tool": "figma_get_context",
  "data": { "connected": true, "documentInfo": {...}, "currentPage": {...} }
}
```

失败 envelope:

```json
{
  "ok": false,
  "tool": "figma_get_context",
  "error": { "code": "NOT_CONNECTED", "message": "..." }
}
```

> CLI 已经解开了 MCP 原生 envelope(`{content:[{text:"..."}], isError}`),所以直接读 `r.data` / `r.error` 即可,不要再去 parse `content[0].text`。

### 12.4 MCP vs CLI 怎么选

| 场景 | 推荐 |
|---|---|
| Claude 实时交互对话 | **MCP bridge**(流式、可见) |
| 写脚本一次性批量(导出 N 张图,改 N 个节点) | **CLI**(可重放,可跑 CI) |
| 调试 / 手测一次 | CLI short form + `--list` |
| fork-only 工具(prototype reactions / flow starting points) | 仍走 MCP bridge(只是 server 换 server) |
| Claude 想把结果再读回上下文 | **MCP**(CLI 输出要再 `Read` JSON 文件才能看) |

### 12.5 关键工具分类(34 个)

| 分类 | 工具 |
|---|---|
| **query** | `figma_get_context` / `figma_list_pages` / `figma_get_nodes` / `figma_search_nodes` / `figma_search_variables` / `figma_get_local_variables` / `figma_search_components` |
| **mutation — appearance** | `figma_set_fills` / `figma_set_strokes` / `figma_set_opacity` / `figma_set_corner_radius` / `figma_set_effects` / `figma_set_text` / `figma_set_text_style` / `figma_set_auto_layout` |
| **mutation — structure** | `figma_create_rectangle` / `figma_create_frame` / `figma_create_ellipse` / `figma_create_text` / `figma_delete_nodes` / `figma_clone_nodes` / `figma_move_nodes` / `figma_resize_nodes` / `figma_group_nodes` / `figma_ungroup_nodes` / `figma_rename_node` |
| **selection / viewport** | `figma_set_selection` / `figma_set_current_page` / `figma_export_node` |
| **variables / styles** | `figma_set_variable` / `figma_create_variable` / `figma_create_variable_collection` / `figma_create_paint_style` / `figma_create_text_style` |

完整清单 + input schema:

```bash
figma list        # 已装 CLI 时
npx -y @nono/figma-cli list   # 临时用 npx
```

### 12.6 工艺纪律(Claude 调 CLI 时)

- **已装就用 `figma`**;**没装 / 不在 PATH 用 `npx -y @nono/figma-cli`**;**有未发布本地副本用 `node <repo>/cli.js`** — 三种形式同等幂(走同一份代码)
- 用 **canonical `call` + `--json`** 形式;**不要** 走 short form 传嵌套对象(`fills: { color: "#FF0000" }` 等,zod 解析不上,见 cli.js:193-226)
- **第一步必须 pollUntilConnected**:3s 间隔 × 60s 超时,`figma call figma_get_context --json '{}'` 直到 `connected: true`。直接调业务工具,上来就 NOT_CONNECTED
- exit code 区分业务错 vs transport 错:**exit=2 看 stderr message**;**exit=3 retry 一下**(可能是 keepalive 断)
- 长 JSON(>8KB)走 `--json-file <path>`,走命令行会被 Windows arglist 截断
- base64 导出后写盘**不**在这里调 — 还是走 §7.3 `figma-save-export.mjs`,CLI 返回的 `data` 字段直接喂它

**轮询范式**(抄 `@nono/figma-cli` 仓库 `e2e.js`,或直接跑 `npm test`):

```js
async function pollUntilConnected(timeoutMs = 60000) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    const { code, stdout } = await runCli('call', 'figma_get_context', '{"":""}'.replace('"":""','{}'));
    if (code === 0) {
      const payload = JSON.parse(stdout);
      if (payload?.data?.connected === true) return payload.data;
    }
    await sleep(3000);
  }
  throw new Error(`Plugin did not connect within ${timeoutMs}ms`);
}
```

### 12.7 反例

```diff
- ❌ 走 short form 传 `fills: { color: "#FF0000" }`(嵌套对象 short form 不会按 zod 解析)
- ❌ 不读 exit code,只看 stdout 有没有内容(0 vs 2 vs 3 都"有内容")
- ❌ 不先 pollUntilConnected 就开始调业务工具
- ❌ 把 stdout 当多行日志 stream 来读(实际是 1 个 JSON 文档)
- ❌ 长 JSON 直接走命令行(--json-file,见 §12.2)
- ❌ CLI 调完再 Read() 整个 stdout JSON(>50KB 时吃 token)— 优先让 CLI 写出 `data` 字段到文件,再 Read 那个文件
- ❌ 把 CLI 当 MCP 替代(Claude 实时对话流式友好 MCP)
```

---

## 13 · figma-bridge-fork 速查

### 13.1 它是什么

`D:/Project/Nono/.tools/figma-bridge-fork/` 是项目**本地 fork** 版的 figma-bridge MCP server。**正典**在它的 `CLAUDE.md`(35 条 Figma-runtime 约束 + 30 FigJam + 4 Prototype + BridgeError 标准化 + Token 优化清单)。

**何时需要看 §13**:你在 MCP 工具列表里看到 fork-only 工具(见 §13.3)时。

### 13.2 与 upstream 关键差异(只看这 5 个)

| # | 差异 | 一句话说明 |
|---|---|---|
| 1 | **FigJam 工具集(21 个)** | sticky / shape_with_text / connector / table / code_block / link_preview;节点在 FigJam 文件里 |
| 2 | **Prototype 工具(4 个)** | `figma_get_reactions` / `add` / `remove` + `set_flow_starting_point`,只 Figma Design 有效 |
| 3 | **BridgeError 标准化** | `NOT_CONNECTED` / `TIMEOUT` / `NODE_NOT_FOUND` / `INVALID_PARAMS` / `OPERATION_FAILED` 统一返回 |
| 4 | **Token 优化** | `figma_search_variables` 替代 `get_local_variables`(25K→500);`depth` 三档(minimal/compact/full);`search_nodes` 优先于递归 `get_children` |
| 5 | **FigJam-only 节点无法 create** | `STAMP` / `HIGHLIGHT` / `WASHI_TAPE` / `WIDGET` / `MEDIA` — Figma API 没有 factory,只能 clone |

### 13.3 fork-only 工具清单

```bash
# 查 fork 实际提供哪些工具(38 个,比 upstream 12 个多)
node D:/Project/Nono/.tools/figma-bridge-fork/src/index.js 2>&1 | head -50
```

或在 MCP server 启动后,从 Claude 工具列表里数。**数字本身不重要**,记住三类**不见于 upstream**:

- FigJam 工具:21 个(看 fork/CLAUDE.md "FigJam Tools Overview" 表)
- Prototype 工具:4 个(`figma_get_reactions` / `add` / `remove` / `set_flow_starting_point`)
- 其它 fork-only 增强:可能 5-10 个(BridgeError 标准化、search 优化等)— 完整列表以 fork 当前 commit 为准

### 13.4 使用 fork 的 5 条铁律(在 fork/CLAUDE.md 第 297-374 行)

> **不在 SKILL 里复制 35 条**,只引最痛 5 条。完整约束以 fork/CLAUDE.md 为准。

1. **URL action + ON_HOVER 会被拒** — 用 ON_CLICK 或 mouse trigger。
2. **OVERLAY 的 overlayRelativePosition 要求目标 frame 上设 `overlayPosition: MANUAL`**。
3. **SCROLL_TO 导航要求 destination 是 source container 的 scrollable 子节点,跨顶层 frame 无效**。
4. **Reactions 用 `setReactionsAsync(newArray)`,不可直接赋值 `node.reactions`**(且要 clone,节点返回的对象是 frozen)。
5. **`PageNode.flowStartingPoints` 是 page-level,不是 frame-level**,改动要 `getPageForNode()` 取页。

### 13.5 反例

```diff
- ❌ 调 fork-only 工具但不看 fork/CLAUDE.md(runtime 报错从字面看不出来因)
- ❌ 用 upstream `node.reactions = arr` 写法调用 fork(被 setReactionsAsync 拒)
- ❌ ON_HOVER + URL 组合调 prototype(见 §13.4 #1)
- ❌ OVERLAY 不设 `overlayPosition: MANUAL` 直接传 overlayRelativePosition
- ❌ 把 fork-only 工具写到**非 fork 项目**里(普通 figma-bridge 没有这些 MCP 工具名)

---

## 14 · 工具一览 + 调用样例库(快速索引)

不重复正文,只放索引。**章节号稳定**(memory 已锚定 §3.4 / §7.0 / §7.1 / §9 / §10 / §11)。

| 章节 | 主题 | 何时查 |
|---|---|---|
| §1 | 工具选择(MCP 工具族) | 写任何 Figma 任务前 |
| §2 | 组件 Page + 复用纪律 | 起新文件 / 加导航栏 / 起卡片组 |
| §3 | 坐标放置 + NodeId 纪律 + 复合组件 6 大陷阱 | 调 `create_*` / 改父框 / 升 Component |
| §4 | state.json 缓存 | 首次进文件 / 切换文件 / page 重命名 |
| §5 | Token 强制(Figma Variables 优先) | 改颜色 / 字号 / 圆角 / 间距 |
| §6 | Section 模式复刻 | 新加 Section |
| §7 | 三步验证法 + save-export.mjs | 完成截图后 |
| §8 | 批量 / 串行操作纪律 | 任何写操作 |
| §9 | figma-resize.mjs 助手 | 改父框 w/h 之后 |
| §10 | figma-validate-bounds.mjs 助手 | 改父框 w/h 之后必跑 |
| §11 | 完工自检清单 | 任务完成前 |
| §12 | Figma CLI(可独立 npm 安装) | 写脚本 / CI / 批量任务;**第一次**:先看 §12.0 bootstrap |
| §13 | fork 速查 | 用 prototype / FigJam 工具时 |
| §14 | 工具一览表(本表) | 找不到入口时 |