---
name: KIE.AI API
description: KIE.AI 图像与视频生成平台 API 调用技能，支持文生图、图生图、文生视频、图生视频、图像放大等功能。触发词：KIE、KIE.AI、AI画图、AI绘图、AI视频、图像生成、视频生成、图片生成、gpt-image、nano-banana、grok-imagine、seedance
---

# KIE.AI API 调用技能

> 渐进式披露 — 按需读取详细文档，避免一次性加载过多信息。

## 第一层：核心认知（必读）

### 你需要知道的三件事

1. **认证**：所有请求需 `Authorization: Bearer YOUR_API_KEY`
2. **基础 URL**：`https://api.kie.ai`（上传接口例外：`https://kieai.redpandaai.co`）
3. **异步模式**：图像/视频生成是异步的 → 创建任务拿 `taskId` → 查询结果或用回调

### 统一响应格式

```json
{ "code": 200, "msg": "success", "data": ... }
```

`code: 200` 表示成功，`data` 为具体内容。

### 接口速查

| 功能 | 方法 | 端点 |
|------|------|------|
| 查询积分 | `GET` | `/api/v1/chat/credit` |
| 获取下载链接 | `POST` | `/api/v1/common/download-url` |
| 文件流上传 | `POST` | `https://kieai.redpandaai.co/api/file-stream-upload` |
| 创建生成任务 | `POST` | `/api/v1/jobs/createTask` |
| 查询任务详情 | `GET` | `/api/v1/jobs/recordInfo` |

### 模型速查

**图像生成：**

| 模型 | `model` 值 | 文生图 | 图生图 |
|------|-----------|:------:|:------:|
| GPT Image 2 文生图 | `gpt-image-2-text-to-image` | ✅ | — |
| GPT Image 2 图生图 | `gpt-image-2-image-to-image` | — | ✅ |
| Nano Banana | `google/nano-banana` | ✅ | — |
| Nano Banana 2 | `nano-banana-2` | ✅ | ✅ |
| Nano Banana Pro | `nano-banana-pro` | ✅ | ✅ |
| Grok Imagine 文生图 | `grok-imagine/text-to-image` | ✅ | — |
| Grok Imagine 图生图 | `grok-imagine/image-to-image` | — | ✅ |

**图像处理：**

| 模型 | `model` 值 | 功能 |
|------|-----------|------|
| Topaz 图像放大 | `topaz/image-upscale` | AI 放大提升分辨率 |

**视频生成：**

| 模型 | `model` 值 | 文生视频 | 图生视频 |
|------|-----------|:--------:|:--------:|
| Grok Imagine 文生视频 | `grok-imagine/text-to-video` | ✅ | — |
| Grok Imagine 图生视频 | `grok-imagine/image-to-video` | — | ✅ |
| Seedance 2.0 | `bytedance/seedance-2` | ✅ | ✅ |
| Seedance 2.0 Fast | `bytedance/seedance-2-fast` | ✅ | ✅ |

### 关键限制

- 下载链接有效期 **20 分钟**
- 上传临时文件 **3 天**后自动删除
- 仅支持 HTTPS

### 积分体系与定价

**积分换算：**

| 换算关系 | 数值 |
|----------|------|
| 1,000 积分 | = 5 美元 |
| 1,000 积分 | = 36 人民币 |
| 当前汇率 | 1 美元 = 6.79 人民币 |
| 1 人民币 | ≈ 27.78 积分 |

**图像模型定价：**

| 模型 | 模式/分辨率 | 积分 | 产出 |
|------|------------|:----:|------|
| gpt-image-2 | 4K | 8 | 1 张图 |
| gpt-image-2 | 2K | 5 | 1 张图 |
| gpt-image-2 | 1K | 3 | 1 张图 |
| nano banana | 文生图 | 4 | 1 张图 |
| nano banana edit | 图生图 | 4 | 1 张图 |
| nano banana 2 | 4K | 12 | 1 张图 |
| nano banana 2 | 2K | 8 | 1 张图 |
| nano banana 2 | 1K | 5 | 1 张图 |
| nano banana pro | 4K | 14 | 1 张图 |
| nano banana pro | 2K | 8 | 1 张图 |
| nano banana pro | 1K | 8 | 1 张图 |
| grok-imagine | 图生图 | 4 | 2 张图 |
| grok-imagine | 文生图 | 4 | 6 张图 |
| grok-imagine | 文生图（质量） | 5 | 4 张图 |

**视频模型定价：**

| 模型 | 分辨率 | 无视频输入 | 有视频输入 | 单位 |
|------|--------|:----------:|:----------:|------|
| seedance-2 | 1080p | 102 | 62 | 积分/秒 |
| seedance-2 | 720p | 41 | 25 | 积分/秒 |
| seedance-2 | 480p | 19 | — | 积分/秒 |
| seedance-2 fast | 720p | 33 | 20 | 积分/秒 |
| seedance-2 fast | 480p | 15.5 | 9 | 积分/秒 |

> 💡 **性价比参考**：grok-imagine 文生图 ≈ ¥0.024/张（最划算）；seedance-2 fast 480p 有视频输入仅 9 积分/秒。
>
> ⚠️ 以上为优惠账号价格，官网标价约为上述的 2 倍。

---

## 第二层：按需深入（读取对应 references 文件）

根据用户的具体需求，读取相应的参考文档：

| 用户需求 | 读取文件 |
|----------|----------|
| 查积分、下载文件、上传文件 | `references/common-api.md` |
| 调用图像生成模型（文生图/图生图） | `references/image-generation.md` |
| 调用视频生成模型（文生视频/图生视频） | `references/video-generation.md` |
| 图像/视频放大等后处理 | `references/image-processing.md` |

**重要**：不要提前读取这些文件，仅在用户提出相关需求时才加载。

---

## 第三层：完整工作流与生产实践（按需读取）

当用户需要：
- 完整的从生成到下载的 Python 代码
- 错误处理与重试模式
- 回调机制配置
- 生产环境最佳实践

读取 `references/advanced-patterns.md`。

---

## 快速命令模板

### 查余额（最简请求）

```bash
curl -X GET "https://api.kie.ai/api/v1/chat/credit" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 文生图（最简请求）

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2-text-to-image",
    "input": {
      "prompt": "YOUR_PROMPT_HERE",
      "aspect_ratio": "auto"
    }
  }'
```

### 获取下载链接

```bash
curl -X POST "https://api.kie.ai/api/v1/common/download-url" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "GENERATED_FILE_URL"}'
```

### 查询任务状态

```bash
curl -X GET "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=TASK_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

成功时解析 `data.resultJson`（JSON 字符串）中的 `resultUrls` 获取文件 URL。
