---
name: figma-guide
description: Figma 编写规范 — 坐标与放置规则、reparent 纪律、token 强制、export 流程。仅当消息中出现 "Figma" 一词时触发(中英文不限)。不要被泛用动词(改/加/修/add/modify/fix)、NodeId 或工具名误触发 —— 那些可能是无关任务。
version: 1.2
---

## 触发条件

仅当用户消息**包含 "Figma" 一词**(英文或中文)时执行本 Skill。

如果消息里没有 "Figma",即使涉及 UI / 颜色 / 组件,也**跳过**本 Skill —— 那可能是代码任务(Vue / React / Tailwind 等)。

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

### 7.1 截图路径原则

推荐 `<项目根>/temp/figma/` —— **必须先 `mkdir -p`**,否则 `figma_export_node` 返回的 base64 需要自己写盘(本工具直接返 base64,不写文件)。

**实际操作**:

```
figma_export_node(nodeId=<id>, format="PNG", scale=2)
→ 返回 { base64, format, scale }
→ Claude 用 Read 工具或脚本解码到 <项目根>/temp/figma/{page-name}-{feature}.png
```

> 与旧版 `save_screenshots` 不同,**单次调用只导一个节点**。需要多个截图时,逐个调用 `figma_export_node`,然后自己汇总到目录。

### 7.2 保存前检查

- 首次保存前 `mkdir -p` 目标目录。
- 重新导出时 `rm -f` 旧文件,避免读到旧图。

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

`<skill>/scripts/figma-resize.mjs`

- 项目本地:`D:/ai-skills/figma-guide/scripts/figma-resize.mjs`
- 全局 skill:`C:/Users/18906/.claude/skills/figma-guide/scripts/figma-resize.mjs`

> 两份内容一致,**改一份后同步另一份**。

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

`<skill>/scripts/figma-validate-bounds.mjs`

- 项目本地:`D:/ai-skills/figma-guide/scripts/figma-validate-bounds.mjs`
- 全局 skill:`C:/Users/18906/.claude/skills/figma-guide/scripts/figma-validate-bounds.mjs`

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