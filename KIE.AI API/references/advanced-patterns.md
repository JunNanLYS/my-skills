# KIE.AI 进阶模式与生产实践

> 当用户需要完整工作流代码、错误处理、回调配置、生产最佳实践时，读取本文件。

---

## 1. 完整工作流：从生成到下载

### Python — 文生图完整流程

```python
import requests
import time

API_BASE = "https://api.kie.ai"
API_KEY = "YOUR_API_KEY"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Step 1: 检查积分
credit = requests.get(f"{API_BASE}/api/v1/chat/credit", headers=HEADERS).json()
print(f"剩余积分: {credit['data']}")
if credit['data'] <= 0:
    raise Exception("积分不足，请充值")

# Step 2: 创建文生图任务
task = requests.post(f"{API_BASE}/api/v1/jobs/createTask", headers=HEADERS, json={
    "model": "gpt-image-2-text-to-image",
    "input": {
        "prompt": "A serene Japanese garden with cherry blossoms at sunset",
        "aspect_ratio": "auto"
    }
}).json()
task_id = task["data"]["taskId"]
print(f"任务已创建: {task_id}")

# Step 3: 轮询查询结果
while True:
    detail = requests.get(
        f"{API_BASE}/api/v1/jobs/recordInfo",
        params={"taskId": task_id},
        headers={"Authorization": f"Bearer {API_KEY}"}
    ).json()
    state = detail["data"].get("state")
    if state == "success":
        import json
        result = json.loads(detail["data"]["resultJson"])
        file_url = result["resultUrls"][0]
        break
    elif state == "fail":
        fail_msg = detail["data"].get("failMsg", "未知错误")
        print(f"任务失败: {fail_msg}")
        exit(1)
    print(f"任务状态: {state}，等待中...")
    time.sleep(5)

# Step 4: 获取下载链接
dl = requests.post(f"{API_BASE}/api/v1/common/download-url", headers=HEADERS, json={
    "url": file_url
}).json()
print(f"下载链接（20分钟有效）: {dl['data']}")

# Step 5: 下载文件到本地
file_resp = requests.get(dl["data"])
with open("generated_image.png", "wb") as f:
    f.write(file_resp.content)
print("文件已保存!")
```

### Python — 图生图完整流程（含文件上传）

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
        data={"uploadPath": "image-to-image", "fileName": "source.jpg"}
    ).json()
source_url = upload["data"]["downloadUrl"]
print(f"图片已上传: {source_url}")

# Step 2: 创建图生图任务
task = requests.post("https://api.kie.ai/api/v1/jobs/createTask", headers=HEADERS_JSON, json={
    "model": "gpt-image-2-image-to-image",
    "input": {
        "prompt": "Transform into watercolor painting style",
        "input_urls": [source_url],
        "aspect_ratio": "auto"
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
with open("output.png", "wb") as f:
    f.write(img.content)
print("图生图结果已保存!")
```

---

## 2. 回调机制

创建任务时传入 `callBackUrl`，任务完成后 KIE.AI 会自动 POST 通知你的服务器：

```json
{
  "model": "gpt-image-2-text-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": { ... }
}
```

### 回调 vs 轮询

| 对比项 | 回调 (callBackUrl) | 轮询 (recordInfo) |
|--------|-------------------|---------------------|
| 实时性 | 任务完成立即通知 | 取决于轮询间隔 |
| API 调用次数 | 1 次 | N 次（通常 5~20 次） |
| 服务器要求 | 需要公网可达的回调端点 | 无要求 |
| 适用场景 | 生产环境 | 开发调试 |

**生产环境强烈建议使用回调**，减少无谓请求、降低延迟。

---

## 3. 错误处理

### 错误码一览

**通用 API 错误：**

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| **401** | 未授权 | 检查 API Key 是否正确，是否带 `Bearer ` 前缀 |
| **402** | 积分不足 | 充值后再试 |
| **422** | 验证错误 | 下载链接接口仅支持 kie.ai 生成的 URL；检查请求参数格式 |
| **500** | 服务器错误 | 稍后重试，建议实现指数退避 |

**任务查询接口（recordInfo）错误：**

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| **400** | 请求参数错误 | 检查 taskId 格式 |
| **404** | 未找到任务 | 验证 taskId 是否正确 |
| **429** | 请求过于频繁 | 降低轮询频率（速率限制：每秒 10 次） |

**任务业务错误（resultJson 中 failCode）：**

| failCode | 含义 | 处理建议 |
|----------|------|----------|
| `422` | 请求参数验证错误 | 查看 `failMsg` 了解详情 |
| `500` | 内部服务器错误 | 稍后重试 |
| `501` | 生成失败 | 查看 `failMsg` 了解具体原因 |

### Python 错误处理封装

```python
import requests
import time

def safe_api_call(url, method="GET", max_retries=3, **kwargs):
    """带重试和错误处理的 API 调用封装"""
    for attempt in range(max_retries):
        try:
            resp = requests.request(method, url, **kwargs)
            data = resp.json()

            if data["code"] == 200:
                return data
            elif data["code"] == 401:
                raise Exception("认证失败：请检查 API Key 是否正确")
            elif data["code"] == 402:
                raise Exception("积分不足，请充值后重试")
            elif data["code"] == 422:
                raise Exception(f"参数验证失败: {data.get('msg', '')}")
            elif data["code"] >= 500:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt  # 指数退避：1s, 2s, 4s
                    print(f"服务器错误，{wait}秒后重试...")
                    time.sleep(wait)
                    continue
                raise Exception(f"服务器错误，已重试 {max_retries} 次")
            else:
                raise Exception(f"未知错误: code={data['code']}, msg={data.get('msg', '')}")

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise Exception("请求超时，请检查网络连接")
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise Exception(f"网络错误: {e}")

    raise Exception(f"请求失败，已重试 {max_retries} 次")
```

---

## 4. 最佳实践

### 积分管理

- **操作前检查**：大批量操作前检查积分余额
- **设置预警**：积分低于阈值时自动告警
- **预算规划**：追踪积分消耗模式
- **优雅降级**：积分不足时给用户友好提示，而非直接报错

### 下载链接使用

- **时效性**：链接 20 分钟过期，获取后**立即下载**
- **适当缓存**：下载后存本地/对象存储，不依赖临时链接
- **批量下载**：在时限内高效处理多个文件
- **失败重试**：为失败的下载实现重试逻辑

### 文件上传

- **大文件用流式**：>10MB 的文件优先用文件流上传
- **注意临时性**：上传文件 3 天自动删除，及时使用
- **文件名管理**：相同文件名会覆盖旧文件，有缓存延迟

### 并发与性能

- **并行下载**：并发下载多个文件（遵守速率限制）
- **连接池**：复用 HTTP 连接（`requests.Session()`）
- **超时设置**：为下载操作设置合理超时
- **进度追踪**：长操作实现进度指示

### 安全

- **API Key 保护**：切勿在客户端代码/前端暴露
- **仅 HTTPS**：所有请求走 HTTPS
- **密钥轮换**：定期轮换 API Key
- **访问日志**：保留 API 使用日志以供审计

---

## 5. 技术支持

| 渠道 | 地址 |
|------|------|
| 官方文档 | [docs.kie.ai](https://docs.kie.ai/cn) |
| API Key 管理 | [kie.ai/api-key](https://kie.ai/api-key) |
| 技术支持邮箱 | support@kie.ai |
