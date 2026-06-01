# KIE.AI 图像生成模型详解

> 当用户需要调用图像生成模型时，读取本文件。

---

## 核心流程

所有图像生成接口都走**异步任务**模式：

```
创建任务 (POST /api/v1/jobs/createTask)
    ↓
返回 taskId
    ↓
查询结果 (GET /api/v1/jobs/recordInfo)  ← 轮询方式
    ↓                                ↘ 回调方式
获取生成文件 URL                    callBackUrl 自动通知
    ↓
调用下载接口换取临时链接
```

### 创建任务 — 通用请求结构

所有图像生成模型共用同一个端点，仅 `model` 和 `input` 参数不同：

```json
POST /api/v1/jobs/createTask
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "<模型标识>",
  "callBackUrl": "https://your-domain.com/api/callback",  // 可选
  "input": { ... }                                        // 各模型不同
}
```

### 通用响应

```json
{ "code": 200, "msg": "success", "data": { "taskId": "task_xxx_1765180586443" } }
```

### 查询任务

```
GET /api/v1/jobs/recordInfo?taskId=TASK_ID
Authorization: Bearer YOUR_API_KEY
```

建议轮询间隔 2~5 秒，生产环境推荐使用 `callBackUrl` 回调。

**任务状态枚举：**

| 状态 | 说明 |
|------|------|
| `waiting` | 已排队等待 |
| `queuing` | 在处理队列中 |
| `generating` | 正在生成 |
| `success` | 成功完成 |
| `fail` | 失败，查看 `failCode` 和 `failMsg` |

**成功时解析 `data.resultJson`**（JSON 字符串），其中 `resultUrls` 为生成文件 URL 数组：

```json
{"resultUrls": ["https://example.com/generated-content.jpg"]}
```

---

## GPT Image 系列

### GPT Image 2 — 文生图

| 项目 | 内容 |
|------|------|
| model | `gpt-image-2-text-to-image` |
| 功能 | 根据文本描述生成图片 |

**定价：**

| 分辨率 | 积分 | 约合人民币 |
|--------|:----:|-----------|
| 4K | 8 | ≈ ¥0.288 |
| 2K | 5 | ≈ ¥0.180 |
| 1K | 3 | ≈ ¥0.108 |

> 💡 通过 `resolution` 参数选择输出分辨率，分辨率越高积分消耗越多。

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `aspect_ratio` | string | ❌ | 宽高比，如 `"auto"` |
| `resolution` | string | ❌ | 分辨率：`"1K"` / `"2K"` / `"4K"`，默认 `"1K"` |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2-text-to-image",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "A cinematic night city poster with neon reflections on a rainy street.",
      "aspect_ratio": "auto"
    }
  }'
```

**Python 示例：**

```python
import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
task = requests.post("https://api.kie.ai/api/v1/jobs/createTask", headers=headers, json={
    "model": "gpt-image-2-text-to-image",
    "input": {
        "prompt": "A cinematic night city poster with neon reflections on a rainy street.",
        "aspect_ratio": "auto"
    }
}).json()
print(f"任务ID: {task['data']['taskId']}")
```

---

### GPT Image 2 — 图生图

| 项目 | 内容 |
|------|------|
| model | `gpt-image-2-image-to-image` |
| 功能 | 基于输入图片和提示词生成新图片 |

**定价：** 与文生图相同，按分辨率计费（4K: 8 / 2K: 5 / 1K: 3 积分）。

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `input_urls` | string[] | ✅ | 源图片 URL 数组（公开可访问） |
| `aspect_ratio` | string | ❌ | 宽高比，如 `"auto"` |
| `resolution` | string | ❌ | 分辨率：`"1K"` / `"2K"` / `"4K"`，默认 `"1K"` |

> 📌 `input_urls` 中的图片必须是公开可访问的 URL。可先通过文件上传接口获取 `downloadUrl`。

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2-image-to-image",
    "input": {
      "prompt": "Transform into watercolor painting style",
      "input_urls": [
        "https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png"
      ],
      "aspect_ratio": "auto"
    }
  }'
```

---

## Google Nano Banana 系列

### Nano Banana — 文生图（基础版）

| 项目 | 内容 |
|------|------|
| model | `google/nano-banana` |
| 功能 | 基于 Google 模型生成图片 |

**定价：** 4 积分/张（≈ ¥0.144）

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `output_format` | string | ❌ | 输出格式，如 `"png"` |
| `image_size` | string | ❌ | 尺寸比例，如 `"1:1"` |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/nano-banana",
    "input": {
      "prompt": "一幅超现实主义风格的画作，巨型香蕉漂浮在宇宙空间中，色彩鲜艳饱满。",
      "output_format": "png",
      "image_size": "1:1"
    }
  }'
```

---

### Nano Banana 2 — 文生图（升级版）

| 项目 | 内容 |
|------|------|
| model | `nano-banana-2` |
| 功能 | Nano Banana 升级版，支持更高分辨率和图生图 |

**定价：**

| 分辨率 | 积分 | 约合人民币 |
|--------|:----:|-----------|
| 4K | 12 | ≈ ¥0.432 |
| 2K | 8 | ≈ ¥0.288 |
| 1K | 5 | ≈ ¥0.180 |

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `aspect_ratio` | string | ❌ | 宽高比，默认 `"auto"` |
| `resolution` | string | ❌ | 分辨率，如 `"2K"` |
| `output_format` | string | ❌ | 输出格式，如 `"jpg"` |
| `image_input` | array | ❌ | 图片输入数组（用于图生图） |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-2",
    "input": {
      "prompt": "高度细致的插画：香蕉造型的未来飞船在霓虹城市上空飞行，4K 质量。",
      "aspect_ratio": "auto",
      "resolution": "2K",
      "output_format": "jpg",
      "image_input": []
    }
  }'
```

---

### Nano Banana Pro — 图生图

| 项目 | 内容 |
|------|------|
| model | `nano-banana-pro` |
| 功能 | Nano Banana Pro 版本，专注图生图 |

**定价：**

| 分辨率 | 积分 | 约合人民币 |
|--------|:----:|-----------|
| 4K | 14 | ≈ ¥0.504 |
| 2K | 8 | ≈ ¥0.288 |
| 1K | 8 | ≈ ¥0.288 |

> 💡 nano banana pro 1K 和 2K 同价（8 积分），2K 性价比更高。**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `image_input` | array | ❌ | 输入图片数组（图生图参考图） |
| `aspect_ratio` | string | ❌ | 画幅比例，如 `"1:1"`、`"9:16"` |
| `resolution` | string | ❌ | 分辨率，如 `"1K"` |
| `output_format` | string | ❌ | 输出格式，如 `"png"` |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-pro",
    "input": {
      "prompt": "漫画海报：戴着墨镜的酷炫香蕉英雄从科幻平台纵身跃起。",
      "image_input": [],
      "aspect_ratio": "1:1",
      "resolution": "1K",
      "output_format": "png"
    }
  }'
```

---

## Grok Imagine 系列

### Grok Imagine — 文生图

| 项目 | 内容 |
|------|------|
| model | `grok-imagine/text-to-image` |
| 功能 | 基于 Grok 模型根据文本描述生成图片 |

**定价：**

| 模式 | 积分 | 产出 | 约合人民币/张 |
|------|:----:|------|-------------|
| 文生图（标准） | 4 | 6 张图 | ≈ ¥0.024 |
| 文生图（质量） | 5 | 4 张图 | ≈ ¥0.045 |

> 💡 Grok Imagine 文生图是**性价比最高**的图像生成方案，标准模式 4 积分得 6 张图。
> 通过 `quality` 参数切换模式：`"standard"`（默认）输出 6 张，`"quality"` 输出 4 张更高质量图片。

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `aspect_ratio` | string | ❌ | 宽高比，如 `"3:2"` |
| `quality` | string | ❌ | 质量：`"standard"`（6 张，4 积分）/ `"quality"`（4 张，5 积分），默认 `"standard"` |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine/text-to-image",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "Cinematic portrait of a woman sitting by a vinyl record player, retro living room, warm earthy tones, 1970s wardrobe, film grain texture, shallow depth of field.",
      "aspect_ratio": "3:2"
    }
  }'
```

---

### Grok Imagine — 图生图

| 项目 | 内容 |
|------|------|
| model | `grok-imagine/image-to-image` |
| 功能 | 基于 Grok 模型对输入图片进行风格转换或内容修改 |

**定价：** 4 积分 / 次，产出 2 张图（≈ ¥0.072/张）。

**文件上传要求：**

| 要求 | 说明 |
|------|------|
| 文件格式 | JPEG、PNG 或 WebP |
| 最大文件大小 | 10MB/文件 |
| 图像数量 | 每次请求最多 **1 张** |

> 📌 需先通过文件上传接口上传参考图，获取 `downloadUrl` 后填入 `image_urls`。

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 图像描述提示词 |
| `image_urls` | string[] | ✅ | 参考图片 URL 数组（最多 1 张） |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine/image-to-image",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "Recreate as a watercolor painting with soft pastel colors",
      "image_urls": [
        "https://static.aiquickdraw.com/tools/example/1767602105243_0MmMCrwq.png"
      ]
    }
  }'
```

---

## 模型对比表

| 模型 | `model` 值 | 文生图 | 图生图 | 积分 | 产出 | 图片输入字段 | 独有参数 |
|------|-----------|:------:|:------:|:----:|------|-------------|----------|
| GPT Image 2 文生图 | `gpt-image-2-text-to-image` | ✅ | — | 3/5/8 | 1 张 | — | `aspect_ratio`, `resolution` |
| GPT Image 2 图生图 | `gpt-image-2-image-to-image` | — | ✅ | 3/5/8 | 1 张 | `input_urls[]` | `aspect_ratio`, `resolution` |
| Nano Banana | `google/nano-banana` | ✅ | — | 4 | 1 张 | — | `image_size`, `output_format` |
| Nano Banana Edit | `google/nano-banana-edit` | — | ✅ | 4 | 1 张 | — | `output_format` |
| Nano Banana 2 | `nano-banana-2` | ✅ | ✅ | 5/8/12 | 1 张 | `image_input[]` | `resolution`, `output_format` |
| Nano Banana Pro | `nano-banana-pro` | ✅ | ✅ | 8/8/14 | 1 张 | `image_input[]` | `resolution`, `output_format`, `aspect_ratio` |
| Grok Imagine 文生图 | `grok-imagine/text-to-image` | ✅ | — | 4/5 | 6/4 张 | — | `aspect_ratio`, `quality` |
| Grok Imagine 图生图 | `grok-imagine/image-to-image` | — | ✅ | 4 | 2 张 | `image_urls[]` | — |

> ⚠️ 注意各系列的图片输入字段不同：
> - GPT Image 系列 → `input_urls`（string 数组）
> - Nano Banana 系列 → `image_input`（object 数组）
> - Grok Imagine 系列 → `image_urls`（string 数组，图生图最多 1 张）
>
> 💡 **积分列说明**：斜杠分隔表示按分辨率 1K/2K/4K 递增；`4/5` 表示标准 4 积分、质量 5 积分。Nano Banana Pro 1K 和 2K 同价（8 积分）。
