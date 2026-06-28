---
name: figma-guide
description: Figma 编写规范 — 坐标与放置规则、reparent 纪律、token 强制、save_screenshots 流程。仅当消息中出现 "Figma" 一词时触发(中英文不限)。不要被泛用动词(改/加/修/add/modify/fix)、NodeId 或工具名误触发 —— 那些可能是无关任务。
version: 1.0
---

## 触发条件

仅当用户消息**包含 "Figma" 一词**(英文或中文)时执行本 Skill。

如果消息里没有 "Figma",即使涉及 UI / 颜色 / 组件,也**跳过**本 Skill —— 那可能是代码任务(Vue / React / Tailwind 等)。

---

# Figma 设计编写规范

> 通用的 Figma 工程纪律。**项目专属的 token、文件 key、NodeId 不写在这里** —— 它们在项目自己的 docs 里。

---

## 1 · 工具选择

### 1.1 优先用 Figma MCP Bridge,不用 Figma MCP

节点的创建 / 修改 / 结构编辑,用 **`mcp__figma-bridge__*`** 工具。`mcp__figma__*` 只用于只读检查(`get_design_context` / `get_metadata` / `get_screenshot` / `get_variable_defs`)。

Bridge 工具清单:

| 类别 | 工具 |
|---|---|
| 创建 | `create_frame` / `create_text` / `create_shape` / `create_image` |
| 修改 | `set_node_properties` / `set_solid_fill` / `set_gradient_fill` / `set_stroke_properties` / `set_effects` / `set_auto_layout` / `set_text_properties` |
| 结构 | `reparent_nodes` / `delete_nodes` / `duplicate_nodes` / `group_nodes` / `ungroup_node` |
| 读取 | `get_node` / `get_metadata` / `get_document` / `get_design_context` / `get_selection` |
| 导出 | `save_screenshots` (批量,PNG/SVG/JPG/PDF) |

### 1.2 Bridge 能力边界

| 能力 | 可用 | 替代方案 |
|---|---|---|
| `create_page` 新建独立 page | ❌ | 新 frames 放到既有 page 上作为子区域 |
| 插入 SVG / vector 图标 | ❌ | 用 Unicode 字符占位 (✏ / × / ⚠ / ▾ / − / ＋) |
| 修改既有 component 的 variants | ❌ | 视觉对齐即可,不强行改 component API |

---

## 2 · 复用与组件 Page(强制)

### 2.1 必须有「组件」Page

每个 Figma 文件**必须**有一个独立的组件 Page(常见命名:`组件` / `Components` / `Library`),用来存放可复用的 Component / Instance / 多状态对照规范。

**首次进入文件时**(`§3.3` 拿到的 `pages` 列表)必须检查:

```
若 pages 中没有 name 匹配 /组件|Components|Library/i 的项:
  → AskUserQuestion 询问用户是否新建
  → 用户同意 → 引导用户去 Figma 手动创建后刷新缓存
  → 用户拒绝 → 允许本轮跳过,但 §2.2 复用纪律降级为"提醒"而非"强制"
```

> 提示:Bridge 工具**没有** `create_page`,新建 Page 只能让用户在 Figma 客户端操作。改完后让用户重跑 `list_files` + `get_metadata` 刷新 `<项目根>/.figma/state.json` 缓存。

### 2.2 复用纪律(强制)

**所有重复出现的视觉单元,优先复用,不重新创建**。常见复用场景:

| 场景 | 复用方法 |
|---|---|
| **导航栏 / 侧边栏 (NavBar / Sidebar)** | 在「组件」Page 定义为 Component → 每页 Instance 引用,改 active 态即可 |
| **标题栏 / 窗口头 (TitleBar)** | 在「组件」Page 定义为 Component → 每页 Instance 引用,改页面标题文字 |
| **页脚 / 状态栏 (Footer / StatusBar)** | 同上,Component + Instance |
| 列表/表格行 | `duplicate_nodes` 复制行 frame,改内部文字/样式 |
| 卡片组(同类卡片 N 张) | 先建一张完整卡片,其余 `duplicate_nodes` + 改文字 |
| 全局组件(按钮/Input/Pill 等) | 从「组件」Page 的 Component 派生 Instance,改 properties |
| 多状态对照(Button default/hover) | `duplicate_nodes` 同一个 button frame 多次,逐个改样式 |

**页面级框架的特殊性**(导航栏/标题栏/页脚):

这些元素**每页都要出现**,但通常**只 copy 一次**(不像表格行会复制 N 次)。复用方式有两种:

```
A. 严格模式(推荐):
   在「组件」Page 创建 Component/Component Set
   → 每页用 Instance 引用,改 instance properties(active 态、标题文字)
   → 改 Component → 所有页面级 Instance 自动同步

B. 简化模式(Component 缺失时):
   第一页 duplicate_nodes 完整复制一份
   → 后续每页 reparent + set_node_properties 改文字
   → ⚠️ 风险:改一处样式要手动同步 N 页,容易漂移
```

**强烈推荐 A 模式**:导航栏/标题栏通常有 hover/active/disabled 等状态,且跨多页必须保持一致,用 Component Set 才能用 Properties 面板切换。

**操作节奏**:

```
1. 先 duplicate 一个完整样本(已有的同结构 frame)
2. 然后改文字 / 颜色 / 尺寸,不改结构层级
3. 最后 get_node 验证坐标不重叠
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
  - 仅在 Component 不存在时,fallback 到 duplicate 同结构 frame
```

> 设计原则:**组件在组件页定义一次,UI 页通过复用引用**。这样改组件 → 所有 Instance 同步更新,避免设计漂移。

---

## 3 · 坐标与放置规则

### 2.1 三条铁律

1. `set_node_properties` 的 `x/y` 是 **节点直接父容器的本地坐标**,**不是**页面绝对坐标。
2. `create_*` 工具默认把新节点放到 **page root**。每次创建后必须**立即** `reparent_nodes` 到目标父容器,再设置本地坐标。
3. 改几何优先用 `set_node_properties`,不要 delete + recreate —— 重建会丢样式,还会断引用。

### 2.2 标准操作节奏

```
创建节点 → reparent 到目标父 → set_node_properties 设本地 x/y
```

### 2.3 NodeId 纪律

- **不要凭记忆推断 NodeId** —— 每次重构 ID 都会变。
- 引用任何已有节点前必须 `get_node` 实测存在。
- 不要一次性批量创建 50+ 节点再验证 —— 中间错位难以回溯。

---

## 4 · 获取 Page 与文件结构

**写 Figma 之前必须先摸清文件结构**。Bridge 工具的 `create_*` 默认落到 page root,但你必须先知道**当前文件有几个 page、各自 NodeId 是什么**。

**核心原则**:**只在首次获取并缓存**;后续 session 直接读缓存,跳过 `list_files` / `get_metadata`。

### 3.1 缓存位置

```
<当前项目根>/.figma/state.json
```

格式:

```json
{
  "fileKey": "unsaved-mqw76b1u-kfmdz6h1",
  "fileName": "Nono",
  "currentPageId": "127:771",
  "currentPageName": "组件",
  "pages": [
    { "id": "0:1", "name": "UI设计" },
    { "id": "127:771", "name": "组件" }
  ],
  "updatedAt": "2026-06-28T12:00:00Z"
}
```


### 3.2 流程:是否首次

```
每次开始 Figma 任务时:
  1. 用 Bash + ls 检查 <项目根>/.figma/state.json 是否存在
     - ls -la <项目根>/.figma/state.json 2>/dev/null
  2. 若存在 → 用 Read 工具读出 fileKey + pages,跳到 §3.4 选定 page 阶段
  3. 若不存在 → 走首次流程 §3.3
```

### 3.3 首次流程

```
第 1 步:确认文件身份
  mcp__figma-bridge__list_files
  → 返回 [{fileKey, fileName}]

第 2 步:列出所有 page
  mcp__figma-bridge__get_metadata(fileKey=<第 1 步拿到的 fileKey>)
  → 返回 {fileName, currentPageId, currentPageName, pageCount, pages: [{id, name}]}

第 3 步:写入缓存
  mkdir -p <项目根>/.figma        (Bash,一次性)
  Write(
    file_path=<项目根>/.figma/state.json,
    content=按 §3.1 格式的 JSON,
  )

第 4 步:继续 §3.4
```

### 3.4 选定 page 后扫内容

无论是否首次,都要做这一步(获取的是 page 内部节点,不在缓存范围内):

```
  mcp__figma-bridge__get_document(fileKey=<fileKey>, depth=2~3)
  → 返回该 page 的节点树

  钻具体节点:
  mcp__figma-bridge__get_node(nodeId=<从 doc 拿到的 id>)
```

### 3.5 何时刷新缓存

以下情况**必须**重新跑 §3.3 并覆盖 `state.json`:

- 用户说"换了个 Figma 文件" / "新文件"
- `list_files` 返回的文件列表与缓存里的 fileKey 不一致
- 用户重命名了 page
- 用户新增/删除了 page

Page ID 不变(参见 §3.6)的情况下,**不要**主动刷新缓存。

### 3.6 关键提示

- **多文件场景必须传 fileKey** —— 当前项目如果只连了一个 Figma 文件,大多数 Bridge 工具可以省略 fileKey,但 `list_files` 仍是确认手段。
- **Page ID 是稳定的** —— Page 是文件级结构,只要不删/不重命名,PageId(`0:1` / `127:771` 这种)不会变。缓存命中后 PageId 可以**直接复用**,不用每次重新 get_metadata。
- **Section / 子节点 ID 不稳** —— 经过大重构(reparent / merge / duplicate / delete+recreate)后 Figma 会重分配局部 ID,**必须**每次实测,不能从对话历史/summary/截图里抄。
- **当前激活页** = `currentPageId`,默认编辑操作落到这里;要写其他 page 必须显式 reparent 到目标 page。
- **没有 create_page 工具**:要在新 page 上工作,只能放到既有 page(参见 §1.2)。
- **缓存不是 session 启动时加载的** —— Skill 是触发式(消息里出现 "Figma" 才加载),所以"首次获取"指的是**首次 Figma 任务**,不是 session 启动。

---

## 5 · Token 强制(通用)

### 4.1 Token 的归属

本 Skill **不**硬编码任何色值、字号阶梯、间距、圆角、阴影、动效。这些信息在项目自己的设计系统文档里(常见的叫法:`docs/DesignSystem.md` / `design-tokens.json` / 等价物)。遇到不确定的颜色,先去查项目 doc,查不到**问用户**。

**禁止**:凭印象硬编码色号(比如把 primary 写成 `#2563EB`)。每个项目的 primary 都不同,写错就污染整个设计。

### 4.2 常见坑

- 价格/百分比/数字一律开 `font-variant-numeric: tabular-nums` 对齐。
- Pill 形组件(radius 999)在 Apple 风格 UI 里很常见 —— 先确认项目是否要求。
- 焦点环通常用 `shadow-glow` 模式(如 `0 0 0 4px rgba(primary, 0.12)`)。
- 任何红/绿/橙/黄的使用前,确认项目 doc 里是否有语义限制(涨跌专用、警示专用、禁用等)。

---

## 6 · Section / 区域模式(通用)

大多数设计系统页把参考内容组织成 Section。**新增 Section 前**先用 §3 的方法定位目标 page,再扫描既有 Section,提取模式:

1. `get_document(fileKey=..., depth=2)` 拿到目标 page 的节点树。
2. 扫描兄弟 Section,提取:宽 / 高 / 描边 / 圆角 / 标题样式 / 副标题样式 / 内容区起点。
3. 新 Section **严格复刻**这个模式。

**不要假设 Section 是固定像素尺寸** —— 永远从兄弟节点测量出来。

---

## 7 · 验证三步法

每个任务完成后:

1. **代码层** —— `get_node` 验证关键节点存在且坐标正确。
2. **视觉层** —— `save_screenshots` 导出 PNG。
3. **业务层** —— Read 截图目视确认无重叠 / 裁切 / 色差。

### 6.1 截图路径原则

推荐 `<项目根>/temp/figma/` —— **必须先 `mkdir -p`**,否则 `save_screenshots` 可能写到 MCP 服务器 cwd 而非项目。

命名:`{page-name}-{feature}.png`。scale=2(高 DPI)。格式 PNG。

### 6.2 保存前检查

- 首次保存前 `mkdir -p` 目标目录。
- 重新导出时 `rm -f` 旧文件,避免 `File already exists` 报错。

---

## 8 · 批量操作

### 7.1 必须批量

- `save_screenshots` —— 一次调用传多个 items
- `delete_nodes` —— 一次调用传多个 ID
- `reparent_nodes` —— 同来源多个 ID 一次调用

### 7.2 必须串行

- 创建 → reparent → 设坐标(单节点一步一步走)
- 同帧内的多层结构(框架 → 标题 → 内容 → 样式,逐层)

### 7.3 反例

```diff
- ❌ 一次性创建 50+ 节点再统一验证(中间错位会级联)
- ❌ set_node_properties 在 reparent 之前(被算成 page-root 偏移)
- ❌ 凭记忆推断 NodeId(每次重构都会变)
- ❌ 删了重建来"修"几何(丢样式和引用)
```

---

## 9 · 完工前自检清单

- [ ] 全程使用 Bridge 工具,未混用 Figma MCP(读取除外)
- [ ] 每个 `create_*` 之后立刻 `reparent_nodes` + 本地坐标
- [ ] 关键节点均通过 `get_node` 验证,未凭记忆推断 NodeId
- [ ] 重复结构(列表行/同型卡片)优先 `duplicate_nodes`,未从头 create
- [ ] 组件 Page 存在,通用组件(Component)在组件页定义一次,UI 页用 Instance 引用
- [ ] 导航栏 / 标题栏 / 页脚等页面级框架,在组件页定义为 Component,每页用 Instance 引用(而非裸 duplicate)
- [ ] 颜色 / 字号 / 圆角 / 间距匹配项目设计系统文档
- [ ] 新 Section 复刻既有 Section 模式(从测量得来,不假设)
- [ ] 截图保存到 `<项目根>/temp/figma/`,scale=2,格式 PNG
- [ ] 截图 Read 目视确认无重叠 / 裁切 / 色差 / 遮挡
- [ ] 未擅自修改或删除项目已交付的内容