# KIE.AI 图像/视频后处理详解

> 当用户需要图像放大、视频放大等后处理操作时，读取本文件。

---

## Topaz 图像放大

基于 Topaz 先进的 AI 放大技术，提升图像分辨率与画质。

| 项目 | 内容 |
|------|------|
| model | `topaz/image-upscale` |
| 功能 | AI 图像放大，提升分辨率与画质 |

**input 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image_url` | string | ✅ | 待放大的图像 URL 地址 |
| `upscale_factor` | string | ✅ | 放大倍数，如 `"2"` |

> ⚠️ `upscale_factor` 是**字符串类型**（`"2"` 而非 `2`），注意类型区分。
>
> 文档中未明确列出 `upscale_factor` 支持的所有可选值，已知示例为 `"2"`。

**请求示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "topaz/image-upscale",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "image_url": "https://static.aiquickdraw.com/tools/example/1762752805607_mErUj1KR.png",
      "upscale_factor": "2"
    }
  }'
```

**Python 示例（含上传 + 放大 + 下载）：**

```python
import requests
import time

API_KEY = "YOUR_API_KEY"
HEADERS_JSON = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
HEADERS_AUTH = {"Authorization": f"Bearer {API_KEY}"}

# Step 1: 上传待放大的图片
with open("source.jpg", "rb") as f:
    upload = requests.post(
        "https://kieai.redpandaai.co/api/file-stream-upload",
        headers=HEADERS_AUTH,
        files={"file": f},
        data={"fileName": "source.jpg"}
    ).json()
source_url = upload["data"]["downloadUrl"]
print(f"图片已上传: {source_url}")

# Step 2: 创建放大任务
task = requests.post("https://api.kie.ai/api/v1/jobs/createTask", headers=HEADERS_JSON, json={
    "model": "topaz/image-upscale",
    "input": {
        "image_url": source_url,
        "upscale_factor": "2"
    }
}).json()
task_id = task["data"]["taskId"]
print(f"任务ID: {task_id}")

# Step 3: 轮询等待结果
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
        file_url = result["resultUrls"][0]
        break
    elif state == "fail":
        fail_msg = detail["data"].get("failMsg", "未知错误")
        raise Exception(f"任务失败: {fail_msg}")
    print(f"状态: {state}，等待...")
    time.sleep(5)

# Step 4: 获取下载链接并保存
dl = requests.post("https://api.kie.ai/api/v1/common/download-url", headers=HEADERS_JSON, json={
    "url": file_url
}).json()
img = requests.get(dl["data"])
with open("upscaled_output.png", "wb") as f:
    f.write(img.content)
print("放大图片已保存!")
```

---

## 模型速查

| 模型 | `model` 值 | 功能 | 必填参数 |
|------|-----------|------|----------|
| Topaz 图像放大 | `topaz/image-upscale` | AI 图像放大 | `image_url`, `upscale_factor` |

---

## 相关接口

Grok Imagine 系列也提供了视频后处理能力（详见 `video-generation.md`）：

| 接口 | `model` 值 | 说明 |
|------|-----------|------|
| 视频放大 | `grok-imagine/upscale-video` | 对已生成视频进行画质提升 |
| 视频扩展 | `grok-imagine/extend-video` | 延长视频时长 |

> 视频放大和视频扩展接口的详细文档需参阅 [docs.kie.ai](https://docs.kie.ai/cn)。
