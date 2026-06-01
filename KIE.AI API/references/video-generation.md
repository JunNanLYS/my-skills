# KIE.AI 视频生成模型详解

> 当用户需要调用视频生成模型时，读取本文件。

---

## 核心流程

视频生成与图像生成共用同一套异步任务机制：

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

> 📌 视频生成耗时通常比图像更长，建议轮询间隔 **5~10 秒**（推荐 2~5 秒，速率限制为每秒 10 次），生产环境强烈推荐使用 `callBackUrl`。

---

## Grok Imagine 系列

### Grok Imagine — 文生视频

| 项目 | 内容 |
|------|------|
| model | `grok-imagine/text-to-video` |
| 功能 | 根据文本描述生成视频 |

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 视频描述提示词 |
| `aspect_ratio` | string | ❌ | 视频宽高比，如 `"2:3"` |
| `mode` | string | ❌ | 生成模式，如 `"normal"` |
| `duration` | string | ❌ | 视频时长（秒），如 `"6"` |
| `resolution` | string | ❌ | 视频分辨率，如 `"480p"` |

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine/text-to-video",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "A couple of doors open to the right one by one randomly and stay open, to show the inside, each is either a living room, or a kitchen, or a bedroom or an office, with little people living inside.",
      "aspect_ratio": "2:3",
      "mode": "normal",
      "duration": "6",
      "resolution": "480p"
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
    "model": "grok-imagine/text-to-video",
    "input": {
        "prompt": "A couple of doors open to the right one by one randomly and stay open.",
        "aspect_ratio": "2:3",
        "mode": "normal",
        "duration": "6",
        "resolution": "480p"
    }
}).json()
print(f"任务ID: {task['data']['taskId']}")
```

---

### Grok Imagine — 图生视频

| 项目 | 内容 |
|------|------|
| model | `grok-imagine/image-to-video` |
| 功能 | 基于输入图片生成视频 |

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 视频描述提示词 |
| `image_urls` | string[] | ✅ | 输入图片 URL 列表 |
| `task_id` | string | ❌ | 关联任务 ID，如 `"task_grok_12345678"` |
| `mode` | string | ❌ | 生成模式，如 `"normal"` |
| `duration` | string | ❌ | 视频时长（秒），如 `"6"` |
| `resolution` | string | ❌ | 分辨率，如 `"480p"` |
| `aspect_ratio` | string | ❌ | 画面比例，如 `"16:9"` |

> 📌 `image_urls` 中的图片必须是公开可访问的 URL。可先通过文件上传接口获取 `downloadUrl`。

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine/image-to-video",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "image_urls": [
        "https://file.aiquickdraw.com/custom-page/akr/section-images/1762247692373tw5di116.png"
      ],
      "prompt": "POV hand comes into frame handing the girl a cup of coffee, she takes it and says happily thanks!",
      "mode": "normal",
      "duration": "6",
      "resolution": "480p",
      "aspect_ratio": "16:9"
    }
  }'
```

**Python 示例（含文件上传 + 图生视频）：**

```python
import requests
import time

API_KEY = "YOUR_API_KEY"
HEADERS_JSON = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
HEADERS_AUTH = {"Authorization": f"Bearer {API_KEY}"}

# Step 1: 上传源图片
with open("source.jpg", "rb") as f:
    upload = requests.post(
        "https://kieai.redpandaai.co/api/file-stream-upload",
        headers=HEADERS_AUTH,
        files={"file": f},
        data={"uploadPath": "video-gen", "fileName": "source.jpg"}
    ).json()
source_url = upload["data"]["downloadUrl"]
print(f"图片已上传: {source_url}")

# Step 2: 创建图生视频任务
task = requests.post("https://api.kie.ai/api/v1/jobs/createTask", headers=HEADERS_JSON, json={
    "model": "grok-imagine/image-to-video",
    "input": {
        "image_urls": [source_url],
        "prompt": "The person in the photo starts walking forward slowly",
        "mode": "normal",
        "duration": "6",
        "resolution": "480p",
        "aspect_ratio": "16:9"
    }
}).json()
task_id = task["data"]["taskId"]
print(f"任务ID: {task_id}")

# Step 3: 轮询等待结果（视频生成耗时较长）
while True:
    detail = requests.get(
        "https://api.kie.ai/api/v1/jobs/recordInfo",
        params={"taskId": task_id},
        headers=HEADERS_AUTH
    ).json()
    state = detail["data"].get("state")
    if state == "success":
        import json
        result = json.loads(detail["data"]["resultJson"])
        video_url = result["resultUrls"][0]
        break
    elif state == "fail":
        fail_msg = detail["data"].get("failMsg", "未知错误")
        raise Exception(f"任务失败: {fail_msg}")
    print(f"状态: {state}，等待...")
    time.sleep(5)

# Step 4: 获取下载链接并保存
dl = requests.post("https://api.kie.ai/api/v1/common/download-url", headers=HEADERS_JSON, json={
    "url": video_url
}).json()
video_resp = requests.get(dl["data"])
with open("output_video.mp4", "wb") as f:
    f.write(video_resp.content)
print("视频已保存!")
```

---

## Bytedance Seedance 系列

### Seedance 2.0 — 多模态视频生成

| 项目 | 内容 |
|------|------|
| model | `bytedance/seedance-2` |
| 功能 | 字节跳动 Seedance 2.0，支持文生视频、图生视频（首帧/首尾帧）、多模态参考生视频、音频生成 |

**定价（积分/秒）：**

| 分辨率 | 无视频输入 | 有视频输入 |
|--------|:----------:|:----------:|
| 1080p | 102 | 62 |
| 720p | 41 | 25 |
| 480p | 19 | — |

> 💡 「有视频输入」即传入 `reference_video_urls` 时适用，价格更低。「无视频输入」覆盖文生视频、图生视频（仅图片输入）等场景。

**三种互斥场景（不可混用）：**

| 场景 | 使用参数 | 说明 |
|------|----------|------|
| 图生视频-首帧 | `first_frame_url` | 提供首帧图片生成视频 |
| 图生视频-首尾帧 | `first_frame_url` + `last_frame_url` | 同时提供首尾帧图片 |
| 多模态参考 | `reference_image_urls` / `reference_video_urls` / `reference_audio_urls` | 提供参考图片、视频或音频 |

> ⚠️ 三种场景**互斥**，不可混用。如需严格保障首尾帧和指定图片一致，优先使用图生视频-首尾帧。

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 视频描述提示词 |
| `first_frame_url` | string | ❌ | 首帧图片 URL（图生视频-首帧模式） |
| `last_frame_url` | string | ❌ | 尾帧图片 URL（图生视频-首尾帧模式） |
| `reference_image_urls` | string[] | ❌ | 参考图片 URL 数组（多模态参考模式） |
| `reference_video_urls` | string[] | ❌ | 参考视频 URL 数组（多模态参考模式） |
| `reference_audio_urls` | string[] | ❌ | 参考音频 URL 数组（多模态参考模式） |
| `return_last_frame` | boolean | ❌ | 是否返回最后一帧，默认 `false` |
| `generate_audio` | boolean | ❌ | 是否生成音频，默认 `false` |
| `resolution` | string | ❌ | 分辨率，如 `"720p"` |
| `aspect_ratio` | string | ❌ | 宽高比，如 `"16:9"` |
| `duration` | number | ❌ | 视频时长（秒），如 `15` |
| `web_search` | boolean | ❌ | 是否启用网络搜索增强，默认 `true` |

**请求示例 — 文生视频：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "宁静的海滩日落景色，海浪轻柔地拍打着岸边，棕榈树在微风中摇曳，海鸥飞过橙色的天空",
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "duration": 15
    }
  }'
```

**请求示例 — 图生视频（首帧）：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2",
    "input": {
      "prompt": "The person in the photo starts walking towards the camera slowly",
      "first_frame_url": "https://example.com/first_frame.png",
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "duration": 15
    }
  }'
```

**请求示例 — 图生视频（首尾帧）：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2",
    "input": {
      "prompt": "Camera smoothly transitions from the first frame to the last frame",
      "first_frame_url": "https://example.com/first_frame.png",
      "last_frame_url": "https://example.com/last_frame.png",
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "duration": 15
    }
  }'
```

**请求示例 — 多模态参考：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2",
    "input": {
      "prompt": "Generate a video following the style of the reference image with similar cinematography",
      "reference_image_urls": ["https://example.com/ref_image.png"],
      "reference_video_urls": ["https://example.com/ref_video.mp4"],
      "generate_audio": true,
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "duration": 15
    }
  }'
```

---

### Seedance 2.0 Fast — 快速版

| 项目 | 内容 |
|------|------|
| model | `bytedance/seedance-2-fast` |
| 功能 | Seedance 2.0 快速版本，参数与标准版完全一致，生成速度更快 |

**定价（积分/秒）：**

| 分辨率 | 无视频输入 | 有视频输入 |
|--------|:----------:|:----------:|
| 720p | 33 | 20 |
| 480p | 15.5 | 9 |

> 💡 seedance-2 fast 不支持 1080p。480p 有视频输入仅 9 积分/秒，是最经济的视频生成方案。

**input 参数：** 与 Seedance 2.0 完全相同，见上方参数表。

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2-fast",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "宁静的海滩日落景色，海浪轻柔地拍打着岸边",
      "first_frame_url": "https://example.com/first_frame.png",
      "last_frame_url": "https://example.com/last_frame.png",
      "reference_image_urls": ["https://example.com/ref_image.png"],
      "reference_video_urls": ["https://example.com/ref_video.mp4"],
      "reference_audio_urls": ["https://example.com/ref_audio.mp3"],
      "return_last_frame": false,
      "generate_audio": false,
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "duration": 15,
      "web_search": true
    }
  }'
```

---

## 模型对比表

| 模型 | `model` 值 | 文生视频 | 图生视频 | 积分/秒（480p） | 最高分辨率 | 图片输入字段 | 多模态参考 |
|------|-----------|:--------:|:--------:|:---------------:|:----------:|-------------|:----------:|
| Grok Imagine 文生视频 | `grok-imagine/text-to-video` | ✅ | — | — | 720p | — | — |
| Grok Imagine 图生视频 | `grok-imagine/image-to-video` | — | ✅ | — | 720p | `image_urls[]` | — |
| Seedance 2.0 | `bytedance/seedance-2` | ✅ | ✅ | 19 | 1080p | `first_frame_url`, `last_frame_url` | ✅ |
| Seedance 2.0 Fast | `bytedance/seedance-2-fast` | ✅ | ✅ | 15.5 | 720p | `first_frame_url`, `last_frame_url` | ✅ |

> 📌 各系列视频模型的差异：
> - **Grok Imagine**：简单直接，`image_urls` 数组传图，适合快速生成
> - **Seedance 2.0**：功能最全，支持首帧/首尾帧精准控制 + 多模态参考（图片/视频/音频）+ 可选音频生成
> - **Seedance 2.0 Fast**：与标准版参数一致，速度更快，适合对质量要求适中但追求效率的场景

---

## 同系列关联接口

**Grok Imagine 系列：**

| 接口 | `model` 值 | 说明 |
|------|-----------|------|
| 文生视频 | `grok-imagine/text-to-video` | 本接口 |
| 图生视频 | `grok-imagine/image-to-video` | 本接口 |
| 视频放大 | `grok-imagine/upscale-video` | 对已生成视频进行画质提升 |
| 视频扩展 | `grok-imagine/extend-video` | 延长视频时长 |

**Bytedance Seedance 系列：**

| 接口 | `model` 值 | 说明 |
|------|-----------|------|
| Seedance 2.0 | `bytedance/seedance-2` | 标准版，质量优先 |
| Seedance 2.0 Fast | `bytedance/seedance-2-fast` | 快速版，速度优先 |

> 视频放大和视频扩展接口的详细文档需参阅 [docs.kie.ai](https://docs.kie.ai/cn)。
