# `figma-to-react` 设计规格

**日期：** 2026-07-15
**状态：** 已经用户逐节确认，待书面规格复核
**目标版本：** `figma-to-react` 1.0

## 1. 背景与目标

### 1.1 背景

仓库已有 `figma-skill`（v2），专门负责**向 Figma 写入**设计（设计→Figma 端到端）。本规格定义一个**互补**技能 `figma-to-react`，专门负责**从 Figma 读出**组件并落地为可立即使用的 React 组件。

两个技能分工对称：

- `figma-skill`：产品需求 → Figma 文件
- `figma-to-react`：Figma 组件 → React 组件 + 统一预览页

### 1.2 目标

把用户在 Figma 中已建好的组件转换为：

1. **可直接 `<Component />` 渲染的 React 组件**（带 inline style，包含 Figma 变量映射的 CSS 变量回退值），无需任何额外 CSS 文件；
2. **统一预览页**：一个 `preview/index.html`，用 ESM React + import map 把所有转换出的组件集中展示；
3. **`.figma-bridges.json`**：每个组件一份，记录哪些节点走了"CSS/SVG 重现"、哪些"位图拍平"、哪些"需人工续写"。

支持单组件和整页批量两种规模。

### 1.3 非目标（首版明确不做）

- 不做 Vue / Svelte / Solid 等其他框架输出（首版只 React）；
- 不做像素级 SSIM 门禁、截图 diff 回路、像素对比；
- 不实现复杂矢量编辑（贝塞尔重绘、路径合并、字体子集化）；
- 不替代 `figma-skill` 的写入流程，不维护 Figma 端的设计系统；
- 不做样式 diff / PR 反馈回路（只读 Figma，不写 Figma）；
- 不托管预览页部署（用户本地起静态服务器即可）。

## 2. 核心决策

1. 技能名固定为 `figma-to-react`（不是 `figma-to-html`、`figma-to-vue`）。
2. 唯一外部依赖是 `figma-cli`（`silships/figma-cli` 2.x），所有 Figma 读取通过 `figma-cli` 子进程完成。
3. 输入路由支持双模式自动切换：Desktop Daemon（`figma-cli daemon` 通时优先）+ Personal Access Token（`figma-cli config` 有 token 时 fallback）。
4. 输入形态支持四种：`--url`（Figma 链接）/ `--file-key + --node` / `--from-find <name>` / `--selection`。
5. 批量与单组件统一使用相同的目录结构 `dist/<ComponentName>/<ComponentName>.jsx`。
6. 预览页一律统一为一个 `preview/index.html`，**禁止**单组件独立预览。
7. React 组件一律使用 inline `style={{...}}`（不带 CSS 文件），保证复制到任何 React 项目即可用。
8. Figma Variables 走 `figma-cli export css` 拿 CSS 自定义属性映射，回退到硬编码值：`background: 'var(--color-primary, #3B82F6)'`。
9. 复杂原语（vector path、mask、blend mode、部分 gradient、effect blur）走"最大努力 CSS/SVG 重现，不能重现就拍平为 `<img>`"，并写入 `.figma-bridges.json`，**不阻断**主流程。
10. 浏览器原生 ESM 不支持 JSX；预览构建阶段必须用 esbuild 预编译 `dist/*/*.jsx` 为 `dist-esm/*.js`，预览页只 import 纯 JS。esbuild 必须在 `package.json` 的 `devDependencies` 中显式声明（首版固定 `^0.24.0`）；`build-preview.mjs` 启动时若 esbuild 缺失，必须自动 `npm install` 并把安装过程写入报告。
11. 所有强制约束使用"必须""禁止""只有……才允许"措辞。
12. `--url` 形态若 URL 里不含 `node-id` 参数（仅 file 级别），必须报错并提示"URL 必须包含 node-id 参数，或改用 `--from-find <name>`"，禁止默认从整个 file 根节点开始转换。

## 3. 目录结构

```text
figma-to-react/
├── SKILL.md                          # 路由合约
├── references/
│   ├── workflow.md                   # 4 阶段流水线
│   ├── react-render.md               # export-jsx → React 组件的映射规则
│   ├── preview.md                    # 统一预览页生成规则
│   ├── input-modes.md                # Daemon + PAT 双模式路由
│   ├── batch.md                      # 整页批量模式
│   └── limitations.md                # 已知不可达项 + 降级方案
├── scripts/
│   ├── resolve-input.mjs             # --url / --file-key / --from-find / --selection → NodeId 列表
│   ├── extract.mjs                   # 调 figma-cli export-jsx / get / find / export css
│   ├── transform.mjs                 # export-jsx 输出 → IR（JSON）
│   ├── render-react.mjs              # IR → React 组件（.jsx + inline style）
│   ├── build-preview.mjs             # 拼装统一预览页（import map + 组件列表）
│   ├── bridges.mjs                   # 生成 .figma-bridges.json
│   └── orchestrate.mjs               # CLI 入口，协调上述
├── schemas/
│   └── ir.schema.json
├── templates/
│   └── preview.html.mjs              # 预览页 HTML 模板
├── tests/
│   ├── fixtures/                     # export-jsx 输出 fixture（可手工构造）
│   ├── transform.test.mjs
│   ├── render-react.test.mjs
│   ├── build-preview.test.mjs
│   └── resolve-input.test.mjs
└── package.json
```

## 4. 端到端状态机

固定主流程如下：

```text
接收需求
  → Workflow 0  选择输入（--url / --file-key / --from-find / --selection）
  → Workflow 1  resolve-input  （探测 daemon / token，路由到 NodeId 列表）
  → Workflow 2  extract         （figma-cli export-jsx + export css）
  → Workflow 3  transform       （export-jsx → IR）
  → Workflow 4  render-react    （IR → dist/<Name>/<Name>.jsx + bridges.json）
  → Workflow 5  build-preview   （esbuild 预编译 + preview/index.html + preview.js）
  → Workflow 6  报告（产物清单 + bridges 摘要 + 起服务命令）
```

可独立运行某阶段，失败可重跑。`extract` / `transform` / `render-react` / `build-preview` 全部支持 `--only <stage>` 重跑。

### 4.1 输入解析（Workflow 1）

`resolve-input.mjs` 探测顺序：

1. 读 `figma-cli status`：daemon-running?
2. 读 `figma-cli config`：有 token?
3. 都不通 → 报错并提示 `figma-cli connect` 或 `figma-cli config set-token <TOKEN>`。
4. daemon 通 → 走 daemon 模式。
5. daemon 不通 + token 有 → 走 PAT 模式。

按用户传入的输入形态取 NodeId：

| 输入形态 | 处理 |
|---|---|
| `--url <figma-url>` | 正则解析 `fileKey` 与 `node-id`（`1-23` → `1:23`），用对应模式调 `figma-cli export-jsx` 或 `figma-cli get` 验证可达 |
| `--file-key <key> + --node <id>` | 直接用 |
| `--from-find <name>` | 调 `figma-cli find <name>`，拿所有匹配 NodeId |
| `--selection` | daemon 模式调 `figma-cli get` 读当前选中；PAT 模式无桌面则报错 |
| 多个 `--node` / `--from-find` 命中多个 | 整批输出 NodeId 列表，进入批量模式 |

### 4.2 提取（Workflow 2）

`extract.mjs` 对每个 NodeId：

- 调 `figma-cli export-jsx <id> --pretty -o <tmp>/<id>.jsx`
- 调 `figma-cli export css -o <tmp>/tokens.css`（一次性，整批共享）
- 调 `figma-cli export screenshot <id> -o <tmp>/<id>.png --scale 2`（可选，复杂原语拍平时作为 `<img>` 数据源）

### 4.3 转换（Workflow 3）

`transform.mjs` 解析 `<id>.jsx`：

- 解析 React JSX 为节点树（自写轻量解析器，不引 babel；只支持 `export-jsx` 输出的受限语法）
- 映射到 IR（JSON，schema 见 §6）
- 校验 IR 符合 `ir.schema.json`，失败时报错含原始 `<id>.jsx` 路径

### 4.4 渲染 React 组件（Workflow 4）

`render-react.mjs` 走映射表（详见 `references/react-render.md`）：

- `Frame` → `<div>` + flexbox inline style
- `Rectangle` / `Ellipse` → `<div>` + 几何 + 背景
- `Text` → `<span>` + 文字 inline style
- 图片 / 复杂原语 → `<img src=...>` 或 inline `<svg>`
- 数值属性 → `'16px'` 带单位
- Figma Variables → `var(--token-name, fallbackValue)` 形式

每个组件输出：

```text
dist/<Name>/
├── <Name>.jsx                       # 默认导出 React 组件
├── <Name>.figma-bridges.json        # 降级记录
└── tokens.css                       # 该组件用到的 CSS 变量（如有）
```

### 4.5 预览构建（Workflow 5）

`build-preview.mjs`：

1. 用 esbuild 把 `dist/*/*.jsx` 编译为 `dist-esm/*/*.js`（`format: 'esm'`、`jsx: 'automatic'`）
2. 生成 `preview/index.html`（来自 `templates/preview.html.mjs`，含 import map + 每组件一个 `<section>`）
3. 生成 `preview/preview.js`（动态 import 所有 `dist-esm/*/*.js`，挂到对应 mount 节点）

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom/client": "https://esm.sh/react-dom@18/client"
  }
}
</script>
```

### 4.6 报告（Workflow 6）

CLI 末尾打印：

- 产物清单（`dist/*/`、`preview/`）
- 每个组件的 bridges 摘要（拍平节点数 / 续写提示数）
- 起服务命令：`npx serve .` 或 `python -m http.server 8000`

## 5. 关键模块契约

| 模块 | 输入 | 输出 | 依赖 |
|---|---|---|---|
| `resolve-input.mjs` | CLI flags | `{ mode: 'daemon' \| 'pat', nodeIds: [...] }` | `figma-cli status`、`figma-cli config` |
| `extract.mjs` | NodeId 列表 + mode | `<tmp>/<id>.jsx`、`<tmp>/tokens.css`、`<tmp>/<id>.png` | `figma-cli` 子进程 |
| `transform.mjs` | `<id>.jsx` | IR JSON | 自写 JSX 解析器 |
| `render-react.mjs` | IR JSON + tokens.css | `<Name>.jsx` + `<Name>.figma-bridges.json` + `tokens.css` | `tokens.css` 解析 |
| `build-preview.mjs` | `dist/*/` | `preview/index.html` + `preview/preview.js` + `dist-esm/*/*.js` | esbuild |
| `orchestrate.mjs` | CLI flags | 调用上述 + 落盘 | 所有上游 |

`extract.mjs` 是唯一调 `figma-cli` 的模块；其余全部纯函数 + fixture 可测。

## 6. IR Schema（概要）

`ir.schema.json` 定义：

```json
{
  "type": "object",
  "required": ["name", "root"],
  "properties": {
    "name": { "type": "string" },
    "nodeId": { "type": "string" },
    "width": { "type": "number" },
    "height": { "type": "number" },
    "tokens": { "type": "object" },
    "root": {
      "type": "object",
      "required": ["type", "children"],
      "properties": {
        "type": { "enum": ["frame", "rectangle", "ellipse", "text", "image", "vector", "group"] },
        "name": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number" },
        "height": { "type": "number" },
        "style": { "type": "object" },
        "children": { "type": "array" }
      }
    },
    "bridges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["nodeId", "kind"],
        "properties": {
          "nodeId": { "type": "string" },
          "kind": { "enum": ["flattened", "needs-rewrite", "font-missing", "effect-lossy"] },
          "reason": { "type": "string" }
        }
      }
    }
  }
}
```

## 7. 节点类型映射表

| Figma 类型 | React 元素 | 主要 inline style |
|---|---|---|
| Frame（auto-layout horizontal） | `<div>` | `display: 'flex'`、`flexDirection: 'row'`、`gap`、`padding` |
| Frame（auto-layout vertical） | `<div>` | `display: 'flex'`、`flexDirection: 'column'`、`gap`、`padding` |
| Frame（none） | `<div>` | 相对定位 + 绝对子元素（用 `position: 'absolute'` + `left/top`） |
| Rectangle | `<div>` | `width`、`height`、`background`、`borderRadius` |
| Ellipse | `<div>` | `width`、`height`、`background`、`borderRadius: '50%'` |
| Text | `<span>`（或 `<p>` 视上下文） | `fontSize`、`fontWeight`、`lineHeight`、`color`、`letterSpacing` |
| Image | `<img>` | `width`、`height`、`objectFit`、`src` |
| Vector（含复杂 path） | inline `<svg>`（可解析时）或 `<img src=拍平 PNG>` | — |
| Group | `<div>`（无视觉样式，保留嵌套） | — |

完整映射细节放在 `references/react-render.md`，不在 SKILL.md 重复。

## 8. 错误处理

| 错误场景 | 处理 |
|---|---|
| `figma-cli` 不在 PATH | 报错并提示安装（参考 `figma-skill` 的 `install-figma-cli.ps1`） |
| daemon + token 都不通 | 报错并提示 `figma-cli connect` 或 `figma-cli config set-token` |
| `export-jsx` 返回空 | 报错并提示检查 NodeId |
| JSX 解析失败 | 报错含原文件路径与行号 |
| IR schema 校验失败 | 报错含失败节点路径 |
| 复杂原语无法重现 | 自动拍平，写 `bridges.json`，**不阻断** |
| 字体在本地不可用 | 写 `bridges.json` 提示需在项目中引入 web font，**不阻断** |
| esbuild 预编译失败 | 报错含失败文件与 esbuild 错误信息 |

## 9. 测试

- `transform.test.mjs`：用 fixture 跑 `transform.mjs`，断言 IR 节点数 / 关键属性 / bridges 数组
- `render-react.test.mjs`：断言 JSX 文本含 `<div style={{ display: 'flex'`、含 `var(--` 变量映射
- `build-preview.test.mjs`：断言 `index.html` 含所有组件 section、`preview.js` 引用了所有 `dist-esm/*/*.js`
- `resolve-input.test.mjs`：mock `figma-cli status` / `figma-cli config` / `figma-cli find` 测 URL 解析与 NodeId 列表

`extract.mjs` 因为调真实 `figma-cli` 不在单元测试范围；端到端测试可单独跑（标记为 `e2e`）。

## 10. Red Flags

- "export-jsx 输出就是 JSX，应该直接能跑" → 错；必须经 `render-react.mjs` 改 inline style、加 px、映射 Figma 元素名为 HTML 标签。
- "Figma 字体一定能用" → 错；本地没装的字体走 bridges 提示，**禁止**静默替换。
- "复杂矢量一定能转 SVG" → 错；不能解析时拍平为 `<img>`，**禁止**抛错阻断。
- "预览页可以每组件一个" → 错；禁止单组件独立预览，必须统一一个 `preview/index.html`。
- "可以直接用 Figma REST API，不依赖 figma-cli" → 错；本技能与 `figma-skill` 对齐，唯一 Figma 入口是 `figma-cli`。
- "可以输出 Vue" → 错；首版明确不做 Vue。

## 11. 与 `figma-skill` 的关系

- `figma-skill` 写 Figma，`figma-to-react` 读 Figma。两者**不共享状态机**，不互调。
- `figma-to-react` 不修改 Figma 任何内容；不进入 `figma-skill` 的 `.figma/` 任务账本。
- `figma-to-react` 输出 `dist/` 与 `preview/`，跟 `figma-skill` 的 `.figma/` 在同一项目根目录可共存，但**禁止互相嵌套**。
- 两个技能的 `SKILL.md` 路由合约各自独立，不互相依赖加载。
