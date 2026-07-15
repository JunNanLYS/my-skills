---
name: figma-to-react
model: sonnet
category: design
description: Use when converting Figma components into directly-usable React components with a unified preview page, driven by figma-cli. Triggers on "figma to react", "export figma as react", "figma component to jsx".
version: 1.0
---

# figma-to-react

将用户在 Figma 中已建好的组件转换为可直接 `<Component />` 渲染的 React 组件，并生成统一预览页。Skill 设计规格：`docs/superpowers/specs/2026-07-15-figma-to-react-design.md`。

## Authority Invariant

- SKILL.md 是路由合约：概述、强制门禁、必读 reference、命令矩阵、Red Flags。
- 所有执行细节、节点映射、命令、术语表、限制说明仅在 `references/`。每个 Workflow 阶段必须加载对应 reference，禁止用 SKILL.md 替代任何一次加载。
- `scripts/extract.mjs` 是唯一调用 `figma-cli` 的模块；其余模块均为纯函数，对 fixture 可测。
- `schemas/ir.schema.json` 是 IR 唯一事实来源；`scripts/transform.mjs` 与 `scripts/render-react.mjs` 必须用 ajv 校验。

## Non-Negotiable Rules

- 所有 Figma 读取必须通过 `figma-cli`，禁止使用 Figma MCP、Figma REST API、GUI 自动化、eval/run 等替代路径。
- 每个新会话首次执行前必须按顺序运行 `figma-cli --version`、`figma-cli --help`、`figma-cli status`；未连接时按 `references/input-modes.md` 路由 daemon / PAT。
- 唯一输出形态是 React 组件 + 统一预览页。禁止输出 Vue / Svelte / Solid；禁止单组件独立预览文件。
- React 组件必须使用 inline `style={{...}}`，禁止生成额外 CSS 文件（tokens.css 例外，仅用于 CSS 变量定义）。
- 数值 CSS 值必须带 `px` 单位出现在 inline style 中；禁止裸数字。
- Figma Variables 走 `figma-cli export css`，渲染为 `var(--token-name, #fallback)` 形式；禁止只输出硬编码回退值。
- 复杂原语（vector path、mask、blend mode、effect blur）走"最大努力 CSS/SVG 重现，不能重现就拍平为 `<img>`"，并写入 `.figma-bridges.json`，**禁止**阻断主流程。
- 浏览器原生 ESM 不支持 JSX；`build-preview.mjs` 必须用 esbuild 预编译 `dist/*/*.jsx` 为 `dist-esm/*/*.js`，**禁止**在浏览器内运行 babel/JSX 转换。
- `--url` 形态若 URL 里不含 `node-id` 参数（仅 file 级别），必须报错并提示使用 `--from-find <name>`，**禁止**默认从 file 根节点开始转换。
- 所有硬性要求必须用"必须""禁止""只有……才允许"措辞；禁止用弱措辞稀释门禁。

## Mandatory Lookups

```text
Workflow 0/1 (输入解析)              → references/input-modes.md
Workflow 2 (extract)                 → references/workflow.md
Workflow 3/4 (transform + render)    → references/react-render.md
Workflow 5 (preview)                 → references/preview.md
批量模式                             → references/batch.md
任何阶段 (1:1 不可达项 / 降级)      → references/limitations.md
```

禁止：用 SKILL.md 替代以上任何一次加载。

## CLI Contract

```bash
figma-to-react --url <figma-url> [--workdir <dir>]
figma-to-react --file-key <key> --node <id> [--workdir <dir>]
figma-to-react --from-find <name> [--workdir <dir>]
figma-to-react --selection [--workdir <dir>]
```

必选其一。`--workdir` 默认 `process.cwd()`。

## Red Flags

- "export-jsx 输出就是 JSX，应该直接能跑" → 错；必须经 `render-react.mjs` 改 inline style、加 px、映射 Figma 元素名为 HTML 标签。
- "Figma 字体一定能用" → 错；本地没装的字体走 bridges 提示，**禁止**静默替换。
- "复杂矢量一定能转 SVG" → 错；不能解析时拍平为 `<img>`，**禁止**抛错阻断。
- "预览页可以每组件一个" → 错；禁止单组件独立预览，必须统一一个 `preview/index.html`。
- "可以直接用 Figma REST API，不依赖 figma-cli" → 错；本技能与 `figma-skill` 对齐，唯一 Figma 入口是 `figma-cli`。
- "可以输出 Vue" → 错；首版明确不做 Vue。
