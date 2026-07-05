# scripts.md

本文件集中说明 `figma-guide` 目录下的 3 个本地辅助脚本。它们都只做**本地计算或本地写盘**，不负责连接 Figma，也不负责替调用方执行设计修改。

## 1. `figma-save-export.mjs`

### 适用场景

- 已拿到导出结果中的 base64 数据。
- 需要把结果可靠写成 PNG。
- 需要在写盘前做 PNG magic 校验。

### 它做什么

- 支持从 `--base64`、`--stdin`、`--in <json或纯base64文件>` 读入数据。
- 自动创建输出目录。
- 解码 base64。
- 校验 PNG 文件头。
- 输出写盘结果 JSON。

### 常用命令

```bash
node figma-save-export.mjs --base64 "<data>" --out <dir> --name preview.png
echo "<data>" | node figma-save-export.mjs --stdin --out <dir>
node figma-save-export.mjs --in ./result.json --out <dir>
```

### 输出

`stdout` 输出 JSON：

```json
{
  "success": true,
  "path": "...",
  "name": "...",
  "bytes": 12345,
  "sha256_prefix": "..."
}
```

### 退出码

- `0`：成功
- `1`：参数错误
- `2`：base64 解码失败或为空
- `3`：目标文件已存在且未允许覆盖
- `4`：不是 PNG 数据

## 2. `figma-resize.mjs`

### 适用场景

- 父框尺寸变了，需要重算内部子节点的几何。
- 不想手算每个子节点的新位置。
- 希望先生成 plan，再由调用方决定如何应用。

### 它做什么

- 接收父框旧尺寸、目标尺寸和子节点几何。
- 按 `center` / `scale` / `anchor` 三种模式生成 plan。
- 输出每个子节点从 `from` 到 `to` 的变化。
- 如存在潜在越界，输出 warning 并以特定退出码返回。

### 核心模式

- `center`：保持相对中心关系。
- `scale`：位置与尺寸同时按比例缩放。
- `anchor`：围绕指定锚点重分布。

### 输入建议

推荐通过 `--config` 提供完整 JSON，包括：

- `parent`
- `newW` / `newH`
- `mode`
- `anchor`
- `children`

### 输出

`stdout` 输出包含：

- `nodeId`
- `ratio`
- `plan[]`
- 每个节点的 `from / to / delta / warnings`

### 退出码

- `0`：成功且无 warning
- `1`：参数错误
- `2`：生成了 warning（例如计划后仍会越界）

## 3. `figma-validate-bounds.mjs`

### 适用场景

- 想检查某个复合结构里是否存在子节点越界。
- 改父框前先拿基线。
- 改父框和子节点后做二次验收。

### 它做什么

- 递归遍历整棵子树。
- 检查每个 parent-child 对是否存在 left / top / right / bottom 溢出。
- 输出汇总统计与逐条 violation 详情。

### 支持的输入格式

#### `--config`

适合手工拼装递归树。

#### `--figma-json`

适合传入 id-indexed 的平铺节点字典：

- `rootId`
- `nodes[id] = { x, y, w, h, clipsContent, children }`

当已有批量节点数据时，这种格式更省事。

### 输出

`stdout` 输出包含：

- `summary`
- `violations[]`
- `tree`

### 退出码

- `0`：全部通过
- `1`：发现越界
- `2`：参数错误

## 4. 推荐组合方式

### 导出验收

```text
导出结果 → figma-save-export.mjs → 打开 PNG 核对
```

### 父框尺寸调整

```text
先 validate-bounds → 再 resize 生成 plan → 应用变更 → 再 validate-bounds
```

## 5. 一致口径

三者都应按同一种口径理解：

- 它们是本地辅助工具。
- 它们不连接 Figma。
- 它们不负责执行设计改动。
- 它们只帮助调用方做写盘、重算和校验。
