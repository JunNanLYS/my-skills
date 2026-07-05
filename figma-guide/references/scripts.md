# scripts.md

本文件只保留 `figma-guide` 目录下仍然有价值的本地辅助脚本。

当前结论：

- `figma-save-export.mjs` 已删除：导出与写盘优先使用 `figma-cli verify --save` 或 `figma-cli export ... -o ...`。
- `figma-resize.mjs` 已删除：布局、约束、auto-layout、pin、sizing 优先使用 `figma-cli` 原生命令。
- `figma-validate-bounds.mjs` 保留：它是一个**离线几何越界审计器**，用于补充 CLI 当前没有优雅覆盖的 parent-child bounds 检查。

## `figma-validate-bounds.mjs`

### 适用场景

- 怀疑复合结构里存在子节点越界。
- 改父框前，想拿一份“修改前”的几何基线。
- 改父框、reparent、批量移动后，想做一次离线安全审计。
- 怀疑 `clipsContent`、局部坐标或层级变动掩盖了真实布局问题。

### 它做什么

- 递归遍历整棵子树。
- 检查每个 parent-child 对是否存在 `left / top / right / bottom` 溢出。
- 输出结构化 JSON，包括 `summary`、`violations[]`、`tree`、`warnings[]`。
- 支持把 `clipsContent=true` 的父节点默认视为“允许裁切”；传 `--strict` 时则照样报问题。

### 支持的输入格式

#### `--config`

适合手工拼装递归树：

```json
{
  "root": {
    "id": "47:212",
    "x": 0,
    "y": 0,
    "w": 360,
    "h": 40,
    "clipsContent": false,
    "children": []
  }
}
```

#### `--figma-json`

适合传入 id-indexed 的平铺节点字典：

```json
{
  "rootId": "47:212",
  "nodes": {
    "47:212": {
      "id": "47:212",
      "x": 0,
      "y": 0,
      "w": 360,
      "h": 40,
      "clipsContent": false,
      "children": ["47:239"]
    },
    "47:239": {
      "id": "47:239",
      "x": 14,
      "y": 8,
      "w": 32,
      "h": 24,
      "clipsContent": false,
      "children": []
    }
  }
}
```

当已有批量节点数据时，这种格式更省事。

### 常用命令

```bash
node figma-validate-bounds.mjs 47:212 --config '{"root":{"id":"47:212","x":0,"y":0,"w":360,"h":40,"clipsContent":false,"children":[]}}'
node figma-validate-bounds.mjs 47:212 --figma-json ./nodes.json
node figma-validate-bounds.mjs 47:212 --figma-json ./nodes.json --strict --tolerance 1
```

### 输出

`stdout` 输出 JSON，重点字段：

- `summary.nodesVisited`
- `summary.parentChildPairs`
- `summary.violationEdges`
- `summary.totalIssues`
- `summary.parentsWithIssues`
- `summary.skippedClippedPairs`
- `violations[]`
- `warnings[]`

### 退出码

- `0`：全部通过
- `1`：发现越界
- `2`：参数错误、输入 JSON 非法、或节点数据不合法

## 推荐组合方式

### 导出验收

```text
figma-cli verify --save / figma-cli export ... -o ... → 打开 PNG 核对
```

### 复杂父框改动

```text
先用 figma-cli 原生命令改布局/约束 → 怀疑越界时跑 figma-validate-bounds.mjs → 继续修正 → 再审计一次
```

## 一致口径

本文件中的脚本按同一种口径理解：

- 它是本地辅助工具。
- 它不连接 Figma。
- 它不负责执行设计改动。
- 它只帮助调用方做离线几何审计。
