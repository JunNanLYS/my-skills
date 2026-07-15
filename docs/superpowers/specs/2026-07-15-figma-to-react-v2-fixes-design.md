# `figma-to-react` v2 — 生产环境修复设计规格

**日期：** 2026-07-15
**状态：** 用户 4 节全部批准，待书面复核
**目标版本：** `figma-to-react` 2.0（整数版号，因动了 preview 构建路径契约）
**前提：** v1.0 spec `2026-07-15-figma-to-react-design.md` 全部决策继续生效，本 spec 仅覆盖 3 处改动。

## 1. 背景与目标

### 1.1 背景

v1.0 发布并通过 whole-branch review（35/35 → 36/36 测试通过）后，用户在生产环境跑了实际转换流程，提炼出 **11 项踩坑**，其中 **2 项是可被本 skill 代码层修复的真实 bug**：

- **#4（结合 #6）— `export-jsx` 经 `npx figma-use` spawn 在 Windows + npm-global 路径下 ENOENT**：用户机器上 `figma-cli` 安装在 `%AppData%\npm\figma-cli.cmd`，但 `spawn('figma-cli', ...)` 找不到。`figma-cli status` 能跑（说明用户调用的是完整路径或别名），但 `extract.mjs` 内的 `defaultRunner` 用的是 bare name。这是 `spawn` 调用面在 Windows 上 `PATHEXT` 不含 `.cmd` 时的已知行为。
- **#8 — `importmap` 不能映射命名导出到 default**：`react-dom/client` 经 esm.sh 暴露的是 `{ default: { createRoot } }`，通过 `<script type="importmap">` 映射 `react-dom/client → esm.sh/react-dom@18/client` 时，`import { createRoot } from 'react-dom/client'` 拿到的是 `undefined`。用户验证：`import { createRoot } from 'https://esm.sh/react-dom@18/client'`（直接 URL）能跑通。

### 1.2 目标

用**最少的脚本改动**让 v1 在用户实际环境中跑通：

1. **生产环境下 `extract.mjs` 的 `defaultRunner` 能自动定位 `figma-cli` 可执行文件**，涵盖 Windows / macOS / Linux 三平台的常见 npm-global 路径，失败时给出明确的诊断信息。
2. **完全剔除 importmap**：`preview/index.html` 不再含 `<script type="importmap">` 块，react / react-dom / react-dom/client 全部走 esm.sh **命名 URL 直导入**。

### 1.3 非目标

- **不**新增 `find-figma-cli.mjs` 等独立诊断脚本 — 用户明确"减少使用脚本"。
- **不**修改 SKILL.md 第 22 行的 Non-Negotiable Rule "禁止使用 Figma MCP、Figma REST API、GUI 自动化、eval/run 等替代路径"。
- **不**修改 Authority Invariant：`scripts/extract.mjs` 仍然是唯一 spawn `figma-cli` 的模块。
- **不**引入 figma-cli `eval` 作为正式数据获取路径 — 用户已选择"仅靠 figma-cli"（指 export-jsx + export css）。
- **不**处理 Figma 126+ 屏蔽 CDP（#1）、daemon 缓存旧 CDP（#2）、`find` 子命令 spawn ETIMEDOUT（#3） — 这些是 Figma 客户端或 figma-cli 自身问题，超出本 skill 控制范围。
- **不**处理 Browser pane 重负载页面渲染超时（#9） — 这是 MCP Browser 工具问题，不在 skill 范围内。
- **不**修复 v1 已知的 Minor #1（`--only` 已记入 v1 review as 已知 1.0 债，未在 v2 范围内）。

## 2. 改动范围（共 3 处）

### 改动 1 — `scripts/extract.mjs` PATH-aware spawn

**唯一改动文件：** `figma-to-react/scripts/extract.mjs`

**改动函数：** `defaultRunner(args)` （v1 line 6-16）

**当前实现（v1）：**

```javascript
function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('figma-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}
```

**新实现：**

新增两个帮助函数（v1 没有）；`defaultRunner` 增加定位逻辑；保留 v1 全部 stdout/stderr/error/close 行为不变。

```javascript
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

// 定位 figma-cli 可执行文件。Windows 优先 where,POSIX 优先 which;
// 两者都失败时按常识顺序探测常见 npm-global 路径。
function locateFigmaCli() {
  // 1. PATH 探测。
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, ['figma-cli'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.trim().split(/\r?\n/)[0];
  }

  // 2. 常识 fallback 路径(全部走 --version 验证有效性)。
  const isWin = process.platform === 'win32';
  const candidates = [
    process.env.npm_config_prefix && `${process.env.npm_config_prefix}${isWin ? '\\' : '/'}node_modules${isWin ? '\\' : '/'}.bin${isWin ? '\\' : '/'}figma-cli${isWin ? '.cmd' : ''}`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli`,
    !isWin && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
    `${process.cwd()}/node_modules/.bin/figma-cli${isWin ? '.cmd' : ''}`,
  ].filter(Boolean);

  for (const c of candidates) {
    if (!c) continue;
    const probe = spawnSync(c, ['--version'], { encoding: 'utf8', stdio: 'ignore' });
    if (probe.status === 0) return c;
  }
  return null;
}

// 失败时,fail-fast 抛错,错误信息包含全部尝试过的路径 + 修复指引。
function figmaCliNotFoundError(triedPaths) {
  return new Error(
    'figma-to-react cannot locate figma-cli.\n\n' +
      'Tried:\n' +
      triedPaths.map(p => `  • ${p}`).join('\n') +
      '\n\nFix: install or link figma-cli globally, then verify with:\n' +
      '  figma-cli --version\n\n' +
      'If figma-cli is already installed, ensure it is on PATH or ' +
      'in one of the locations searched above.'
  );
}

function defaultRunner(args) {
  const located = locateFigmaCli();
  if (!located) {
    // 重新走一遍 triedPaths 收集,便于错误信息完整。
    const allTried = [
      `${process.platform === 'win32' ? 'where' : 'which'} figma-cli (PATH)`,
      process.env.npm_config_prefix && `${process.env.npm_config_prefix}${process.platform === 'win32' ? '\\' : '/'}node_modules/.bin/figma-cli`,
      process.platform === 'win32' && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
      process.platform !== 'win32' && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
      `${process.cwd()}/node_modules/.bin/figma-cli`,
    ].filter(Boolean);
    return Promise.reject(figmaCliNotFoundError(allTried));
  }
  return new Promise((resolve, reject) => {
    // Windows 下用 shell:true 让 .cmd / .ps1 能被正确解析。
    const proc = spawn(located, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}
```

**契约变化（adapters 注意）：**

- `runner(args)` 失败抛 `Error`（之前是 `spawn` 的 `ENOENT` 直接 reject）。e2e test 18 的 stub runner 不受影响（它是 callable function, 已被 orchestrator 适配）。
- 所有现有调用 extract.mjs 的代码（orchestrate.mjs line 80）无需改动 — 它只 `.js` 文件 `code !== 0` 路径，错误抛出靠 Promise 链路传播到 `main().catch(...)`。

**测试更新：** `tests/extract.test.mjs` 增加：

```javascript
test('extract: spawn ENOENT 时,fail-fast 并报清晰诊断', async () => {
  // 强制 spawn ENOENT 的策略:让 locateFigmaCli 返回 null。
  // 通过把 PATH 设成不存在的目录 + 清掉所有定位兜底的环境变量。
  await withEnv({ PATH: '/nonexistent', npm_config_prefix: '', APPDATA: '', HOME: '' }, async () => {
    await assert.rejects(
      extract({ nodeIds: ['1:1'], mode: 'daemon', workdir: tmp, runner: defaultRunner }),
      /cannot locate figma-cli/
    );
  });
});

test('extract: locateFigmaCli 找到 PATH 入口时,后续 spawn 用该入口', async () => {
  // 用一个伪造的 figma-cli 桩,记录 spawn args 而不是真的连 Figma。
  // 期望 locateFigmaCli 至少探到 PATH、调用了 export-css 子命令。
});
```

**风险与限制：**

- `locateFigmaCli` 在 Windows 包含 `shell:true`,这意味着 figma-cli 路径里的空格会被 shell 解析。本技能不处理路径含空格的边缘 case — 假设 figma-cli 安装路径不含空格（npm-global 默认 `%AppData%\npm\`，无空格）。
- 探测顺序不保证穷尽所有安装位置,但覆盖 v1 报告中遇到的全部情况（PATH / npm-global / 项目本地）。

---

### 改动 2 — `templates/preview.html.mjs` 剔除 importmap

**唯一改动文件：** `figma-to-react/templates/preview.html.mjs`

**改进行：** 删除第 21-28 行的 `<script type="importmap">` 块。其他不变。

**diff（spec 形式）：**

```diff
   <style>
     body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; background: #F9FAFB; color: #111827; }
     ...
   </style>
-  <script type="importmap">
-  {
-    "imports": {
-      "react": "https://esm.sh/react@18",
-      "react-dom/client": "https://esm.sh/react-dom@18/client"
-    }
-  }
-  </script>
 </head>
```

**为何：** 浏览器 importmap 映射 `react-dom/client → esm.sh/react-dom@18/client` 时，`import { createRoot } from 'react-dom/client'` 拿到的是 `undefined`——esm.sh 把 `react-dom/client` 包整体视作 default 导出 + 命名导出的 namespace，importmap 不能在该 namespace 内做第二次重映射。直接走完整 URL `https://esm.sh/react-dom@18/client` 能用。

**新依赖解决点：** 由改动 3 处理 — 在 `dist-esm/react-esm.mjs` 与 `dist-esm/react-dom-client-esm.mjs` 中走命名 URL 导出（两个文件都是 `.mjs` 后缀，避免与 esbuild 产物混在一起），然后 esbuild 把组件 `.jsx` 的 `from 'react'` 与 `from 'react-dom/client'` 全部改写为从 esm proxy 导入。

**测试更新：** `tests/build-preview.test.mjs` 已有断言 `renderedHtml` 含 `data-component=...`；增加：

```javascript
test('preview HTML 不含 importmap 块', () => {
  const html = renderPreviewHtml(['Button']);
  assert.ok(!html.includes('importmap'), 'preview HTML 不能含 importmap');
});
```

---

### 改动 3 — `scripts/build-preview.mjs` 重写 preview.js

**唯一改动文件：** `figma-to-react/scripts/build-preview.mjs`

**改动函数：** `buildPreview({ workdir })` 整体

**当前实现（v1 53 行）：**

1. esbuild 把每个 `dist/<Name>/<Name>.jsx` 预编译为 `dist-esm/<Name>/<Name>.js`，使用 `external: ['react', 'react-dom/client']`。
2. 输出 `preview/index.html`（用 `templates/preview.html.mjs`）。
3. 输出 `preview/preview.js`，内容形如：

   ```javascript
   import React from 'react';
   import { createRoot } from 'react-dom/client';
   import Badge from '../dist-esm/Badge/Badge.js';
   // ...
   for (const [name, mount] of mounts) { /* render */ }
   ```

   这套依赖 importmap 给 `react`、`react-dom/client` 提供映射。

**新实现（三步）：**

**步骤 a — 在 `dist-esm/` 下生成 2 个 URL 代理模块：**

由 `build-preview.mjs` 直接写文件，不新增脚本。**模块名**采用 `react-esm.mjs` 与 `react-dom-client-esm.mjs`，避免被 esbuild 视为额外入口参与编译(`.mjs` 后缀不参与 esbuild 的 jsx 编译循环，但被浏览器作为 ES module 识别):

```javascript
// dist-esm/react-esm.mjs
// Auto-generated by build-preview; do not edit by hand.
export { default } from 'https://esm.sh/react@18';
export * from 'https://esm.sh/react@18';
```

```javascript
// dist-esm/react-dom-client-esm.mjs
// Auto-generated by build-preview; do not edit by hand.
export * from 'https://esm.sh/react-dom@18/client';
```

**步骤 b — esbuild 外部化 + import 改写：**

保留 v1 的 esbuild 配置 `external: ['react', 'react-dom/client']`、`format: 'esm'`、`jsx: 'automatic'`。在 esbuild 输出 `.js` 文件后，对每个 `dist-esm/<Name>/<Name>.js` 做简单的 import 行改写（**相对路径**：`dist-esm/<Name>/<Name>.js` 中 `../react-esm.mjs` → `dist-esm/react-esm.mjs`）：

- `import React from 'react'` → `import React from '../react-esm.mjs'`
- `import { createRoot } from 'react-dom/client'` → `import { createRoot } from '../react-dom-client-esm.mjs'`

改写规则只动以 `from 'react'` 或 `from 'react-dom/client'` 结尾的 import 行，不动其他文本。esbuild 输出当前格式稳定（`render-react.mjs` 生成 `import React from 'react'` 一行 + 调用 `React.createElement(...)`），所以正则/字符串替换足够：

```javascript
function rewriteImports(esmSrc, name) {
  let out = esmSrc;
  out = out.replace(
    /from\s+['"]react['"]/g,
    `from '../react-esm.mjs'`
  );
  out = out.replace(
    /from\s+['"]react-dom\/client['"]/g,
    `from '../react-dom-client-esm.mjs'`
  );
  return out;
}
```

**步骤 c — `preview.js` 改为动态 import（注意相对路径从 `preview/` 出发）：**

```javascript
// preview.js
const mounts = [
  /* 由 build-preview.mjs 在生成时静态注入组件名数组 */
  'Badge', 'Button', /* ... */
];
for (const name of mounts) {
  try {
    const mod = await import(`../dist-esm/${name}/${name}.js`);
    const el = document.getElementById(`mount-${name}`);
    if (el && mod.default) {
      const { createRoot } = await import('../dist-esm/react-dom-client-esm.mjs');
      const root = createRoot(el);
      root.render(mod.default());
    }
  } catch (e) {
    console.error(`Failed to render ${name}:`, e);
  }
}
```

> **相对路径注意**：`dist-esm/<Name>/<Name>.js` 用 `../react-esm.mjs`(指 `dist-esm/react-esm.mjs`)；`preview/preview.js` 用 `../dist-esm/react-dom-client-esm.mjs`(指 `dist-esm/react-dom-client-esm.mjs`)。两套相对路径各自从不同深度出发，不要混淆。

**测试更新：** `tests/build-preview.test.mjs` 增加：

```javascript
test('build-preview 生成 react-esm.mjs 和 react-dom-client-esm.mjs,内容走 esm.sh 命名 URL', async () => {
  const work = mkdtempSync(join(tmpdir(), 'ftr-bp-'));
  // ... 准备 dist/<Name>/<Name>.jsx fixture ...
  await buildPreview({ workdir: work });
  const reactEsm = readFileSync(join(work, 'dist-esm', 'react-esm.mjs'), 'utf8');
  assert.match(reactEsm, /from\s+['"]https:\/\/esm\.sh\/react@18['"]/);
  const rdEsm = readFileSync(join(work, 'dist-esm', 'react-dom-client-esm.mjs'), 'utf8');
  assert.match(rdEsm, /from\s+['"]https:\/\/esm\.sh\/react-dom@18\/client['"]/);
});

test('build-preview 把组件 .js 的 from \'react\' 改写为从 esm proxy 导入', async () => {
  // ... 验证 dist-esm/<Name>/<Name>.js 中不含裸 'react' import
  const js = readFileSync(join(work, 'dist-esm', 'Button', 'Button.js'), 'utf8');
  assert.ok(!/from\s+['"]react['"]/.test(js), '不应保留 from \'react\'');
  assert.match(js, /from\s+['"]\.\.\/react-esm\.mjs['"]/);
});

test('build-preview 把组件 .js 的 from \'react-dom/client\' 改写为从 esm proxy 导入', async () => {
  const js = readFileSync(join(work, 'dist-esm', 'PreviewEntry', 'PreviewEntry.js'), 'utf8');
  assert.ok(!/from\s+['"]react-dom\/client['"]/.test(js));
  assert.match(js, /from\s+['"]\.\.\/react-dom-client-esm\.mjs['"]/);
});

test('build-preview 不输出 importmap', async () => {
  const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
  assert.ok(!html.includes('importmap'));
});
```

**e2e test（tests/e2e.test.mjs）更新：**

v1 已经断言 `preview/index.html` 存在。增加：

```javascript
const html = readFileSync(join(work, 'preview', 'index.html'), 'utf8');
assert.ok(!html.includes('importmap'), 'preview 不应含 importmap');
const previewJs = readFileSync(join(work, 'preview', 'preview.js'), 'utf8');
assert.ok(!/from\s+['"]react['"]/.test(previewJs), 'preview.js 不应依赖 importmap');
```

**风险与限制：**

- 改写 import 行的做法依赖 esbuild 输出格式。当前 `render-react.mjs` 输出 `import React from 'react'` 一行，单行简洁。如果未来 `render-react.mjs` 改为多行 import 风格或加 `assert { type: '...' }` 子句，需要调整改写正则。在 spec 中标注为 v2 责任：保持 `render-react.mjs` 的 import 行格式稳定。
- esm proxy 文件由 build-preview 自动生成，不允许用户手工编辑。这点不需要专门拦截 — 用户也找不到在 build 输出目录外有什么理由去碰 proxy。
- esm.sh 是外部依赖。如果 esm.sh 离线或限速，预览页会无法加载。这个风险 v1 也存在（importmap 本来也指 esm.sh），不视为回归。

---

## 3. 不动 / 显式不变的事

为避免 spec 漂移（v1 review 已踩过），明确以下**保持不变**：

| 项目 | v1 状态 | v2 状态 |
|---|---|---|
| Authority Invariant (`scripts/extract.mjs` 是唯一 spawn `figma-cli` 的模块) | 成立 | **不变** |
| SKILL.md Non-Negotiable Rule 第 22 行 | "禁止...eval/run 等替代路径" | **不变**（本规格不引入 eval 路径） |
| SKILL.md `version` 字段 | 1.0 | 改 **2.0** |
| IR JSON Schema / ajv 校验 | 全部保留 | **不变** |
| 7 个节点类型映射（react-render.md v1） | 全部保留 | **不变** |
| 4 种输入形态 (`--url` / `--file-key + --node` / `--from-find` / `--selection`) | 全部保留 | **不变** |
| `dist/<Name>/<Name>.jsx` + `.figma-bridges.json` 输出结构 | 成立 | **不变** |
| esbuild 预编译 `dist-esm/` | 成立 | **不变**（仍 esbuild，仍 `format: 'esm'` `jsx: 'automatic'` `external: ['react', 'react-dom/client']`） |
| var(--token, fallback) 变量映射 | 成立 | **不变** |
| `:root { --token: value }` tokens.css | 成立 | **不变** |
| 限制声明（limitations.md） | 已记录 effect-lossy / font-missing / flattened / needs-rewrite | **不变** |
| 4 阶段流水线（resolve / extract / transform / preview） | 成立 | **不变** |
| `--only <phase>` v1 review 已知 1.0 债 | 未实现 | **不**在 v2 范围内（用户未要求） |
| `test(test)` 框架（Node built-in） | 成立 | **不变** |

## 4. 错误处理 — 改 / 增 / 不动

| 场景 | v1 | v2 |
|---|---|---|
| `figma-cli` 不在 PATH（spawn ENOENT） | reject with raw spawn error | **reject with figmaCliNotFoundError**：包含全部尝试过的路径 + 修复指引 |
| `figma-cli export-jsx <id>` 返回非 0 | `Error('figma-cli export-jsx ... failed')` | **不变** |
| esbuild 缺失 | `build-preview.mjs` 报 `npm install` 指引（v1 决策 #10） | **不变** |
| importmap 缺失导致 `createRoot is not a function` | 偶发暴露（用户报告 #8） | **消除**：preview.js 直接 URL 导入，不再依赖 importmap |

## 5. 测试策略

| 文件 | 改动 |
|---|---|
| `tests/extract.test.mjs` | + 2 case（ENOENT 诊断、locateFigmaCli 找到 PATH 入口） |
| `tests/build-preview.test.mjs` | + 4 case（esm proxy 文件、import 改写 ×2、不含 importmap） |
| `tests/e2e.test.mjs` | + 2 断言（preview 不含 importmap、preview.js 不依赖 importmap） |

全部既有 36/36 测试保留。改动后预期 **36 + 8 = 44 case pass**。

## 6. 红旗（仍生效 + 新增）

沿用 v1 全部红旗，新增：

| Red Flag | 措辞（v1 已有的不重复） |
|---|---|
| "在浏览器内运行 babel/JSX 转换可以省去 esbuild" | 错；spec v1 决策 #10 已禁，本 v2 不变 |
| "importmap 能搞定一切 react 依赖" | 错；react-dom/client 的 default / named 命名空间嵌套映射不工作，必须走直接 URL |
| "找不到 figma-cli 是 skill 范围外" | 错；本 skill 的 extract 阶段必须提供清晰的 spawn 失败诊断 |
| "再加一个 find-figma-cli.mjs 脚本就能解决定位" | 错；v2 显式禁止新增独立诊断脚本，定位逻辑封在 extract.mjs 内部 |

## 7. 与 `figma-skill` 关系

v1 spec §11 已明确本技能与 `figma-skill` 是互补技能，目录不重叠，依赖关系单向（仅读取 Figma）。v2 不动这一关系。

## 8. 实施路线（不在本 spec 内）

本 spec 仅定义契约，不写代码或 plan。spec 用户审核通过后，移交 `writing-plans` skill 生成实施 plan，按 SDD 流程拆任务。预计 3-4 个 task + 全量回归。

---

**确认：** 本规格改动只覆盖 3 个文件 (`scripts/extract.mjs`、`scripts/build-preview.mjs`、`templates/preview.html.mjs`) + 2 个测试文件 (`tests/extract.test.mjs`、`tests/build-preview.test.mjs`、`tests/e2e.test.mjs`)。其余文件不动。
