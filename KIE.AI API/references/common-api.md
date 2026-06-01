# KIE.AI 通用 API 详解

> 当用户需要查询积分、获取下载链接、上传文件、查询任务状态时，读取本文件。

***

## 1. 查询任务详情

所有生成任务都是异步的，创建任务后需通过此接口查询状态和获取结果。

| 项目 | 内容                        |
| -- | ------------------------- |
| 方法 | `GET`                     |
| 路径 | `/api/v1/jobs/recordInfo` |
| 参数 | `taskId`（Query 参数，必填）     |

**任务状态枚举：**

| 状态           | 说明     | 建议                        |
| ------------ | ------ | ------------------------- |
| `waiting`    | 已排队等待  | 继续轮询                      |
| `queuing`    | 在处理队列中 | 继续轮询                      |
| `generating` | 正在生成   | 继续轮询                      |
| `success`    | 成功完成   | 解析 `resultJson` 获取结果      |
| `fail`       | 失败     | 查看 `failCode` 和 `failMsg` |

**响应示例：**

```json
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "task_12345678",
        "model": "grok-imagine/text-to-image",
        "state": "success",
        "param": "{\"model\":\"grok-imagine/text-to-image\",...}",
        "resultJson": "{\"resultUrls\":[\"https://example.com/generated-content.jpg\"]}",
        "failCode": "",
        "failMsg": "",
        "costTime": 15000,
        "completeTime": 1698765432000,
        "createTime": 1698765400000,
        "updateTime": 1698765432000
    }
}
```

**关键字段说明：**

| 字段                | 类型     | 说明                                               |
| ----------------- | ------ | ------------------------------------------------ |
| `data.state`      | string | 任务状态（见上方枚举）                                      |
| `data.resultJson` | string | **JSON 字符串**，需解析。成功时包含 `resultUrls`（生成文件 URL 数组） |
| `data.failCode`   | string | 失败错误码（成功时为空）                                     |
| `data.failMsg`    | string | 失败错误描述（成功时为空）                                    |
| `data.costTime`   | number | 任务耗时（毫秒）                                         |

> 📌 `resultJson` 是 **JSON 字符串**，需要 `JSON.parse()` / `json.loads()` 解析后使用。
>
> 生成文件 URL 在 `resultJson.resultUrls` 数组中，取第一个元素即可。

**提取结果的代码片段：**

```python
import json
result = json.loads(detail["data"]["resultJson"])
file_url = result["resultUrls"][0]
```

**速率限制：** 每个 API Key 每秒最多 10 次查询，推荐轮询间隔 2\~5 秒。

***

## 2. 查询账户积分

| 项目 | 内容                    |
| -- | --------------------- |
| 方法 | `GET`                 |
| 路径 | `/api/v1/chat/credit` |
| 参数 | 无                     |

**响应：**

```json
{ "code": 200, "msg": "success", "data": 100 }
```

`data` 为整数，表示当前剩余积分。

### 积分换算体系

| 换算关系 | 数值 |
|----------|------|
| 1,000 积分 | = 5 美元 |
| 1,000 积分 | = 36 人民币 |
| 当前汇率 | 1 美元 = 6.79 人民币 |
| 1 人民币 | ≈ 27.78 积分 |
| 1 美元 | ≈ 200 积分 |

**快速换算：**

| 积分 | 美元 | 人民币 |
|------|------|--------|
| 1 | $0.005 | ≈ ¥0.036 |
| 3 | $0.015 | ≈ ¥0.108 |
| 4 | $0.020 | ≈ ¥0.144 |
| 5 | $0.025 | ≈ ¥0.180 |
| 8 | $0.040 | ≈ ¥0.288 |
| 100 | $0.50 | ≈ ¥3.60 |

**多语言示例：**

```python
# Python
import requests
headers = {"Authorization": "Bearer YOUR_API_KEY"}
resp = requests.get("https://api.kie.ai/api/v1/chat/credit", headers=headers)
print(resp.json())  # {"code": 200, "msg": "success", "data": 100}
```

```javascript
// JavaScript
const resp = await fetch("https://api.kie.ai/api/v1/chat/credit", {
  headers: { Authorization: "Bearer YOUR_API_KEY" }
});
const data = await resp.json();
console.log(data); // { code: 200, msg: "success", data: 100 }
```

***

## 3. 获取下载链接

生成任务返回的文件 URL 不能直接下载，需通过此接口换取临时下载链接。

| 项目           | 内容                            |
| ------------ | ----------------------------- |
| 方法           | `POST`                        |
| 路径           | `/api/v1/common/download-url` |
| Content-Type | `application/json`            |

**请求参数：**

| 参数    | 类型     | 必填 | 说明               |
| ----- | ------ | -- | ---------------- |
| `url` | string | ✅  | kie.ai 生成的文件 URL |

> ⚠️ 仅支持 kie.ai 生成的文件 URL，外部 URL 返回 **422** 错误。

**响应：**

```json
{
  "code": 200,
  "msg": "success",
  "data": "https://tempfile.1f6cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxbd98"
}
```

`data` 为临时下载链接，有效期 **20 分钟**。

**cURL 示例：**

```bash
curl -X POST "https://api.kie.ai/api/v1/common/download-url" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_GENERATED_FILE_URL"}'
```

**Python 示例：**

```python
import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {"url": "YOUR_GENERATED_FILE_URL"}
resp = requests.post(
    "https://api.kie.ai/api/v1/common/download-url",
    json=payload, headers=headers
)
print(resp.json())
```

***

## 4. 文件流上传

用于上传本地文件（如图片）作为图生图等任务的输入源。

| 项目           | 内容                                                   |
| ------------ | ---------------------------------------------------- |
| 方法           | `POST`                                               |
| 路径           | `https://kieai.redpandaai.co/api/file-stream-upload` |
| Content-Type | `multipart/form-data`                                |

> 📌 注意：上传接口的域名与主 API 不同，是 `kieai.redpandaai.co`。

**请求参数：**

| 参数           | 类型     | 必填 | 说明                                              |
| ------------ | ------ | -- | ----------------------------------------------- |
| `file`       | File   | ✅  | 要上传的文件（二进制流）                                    |
| `uploadPath` | string | ❌  | 上传路径，如 `"images/user-uploads"`                  |
| `fileName`   | string | ❌  | 自定义文件名，如 `"my-image.jpg"`（不指定则自动生成；相同文件名会覆盖旧文件） |

**响应：**

```json
{
  "success": true,
  "code": 200,
  "msg": "File uploaded successfully",
  "data": {
    "fileName": "uploaded-image.png",
    "filePath": "images/user-uploads/uploaded-image.png",
    "downloadUrl": "https://tempfile.redpandaai.co/xxx/images/user-uploads/uploaded-image.png",
    "fileSize": 154832,
    "mimeType": "image/png",
    "uploadedAt": "2025-01-01T12:00:00.000Z"
  }
}
```

| 字段                 | 说明                                       |
| ------------------ | ---------------------------------------- |
| `data.fileName`    | 文件名                                      |
| `data.filePath`    | 存储路径                                     |
| `data.downloadUrl` | 文件下载链接（**可传给图生图等接口作为** **`input_urls`**） |
| `data.fileSize`    | 文件大小（字节）                                 |
| `data.mimeType`    | MIME 类型（自动识别）                            |
| `data.uploadedAt`  | 上传时间（ISO 8601）                           |

**cURL 示例：**

```bash
curl -X POST "https://kieai.redpandaai.co/api/file-stream-upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F 'file=@"/path/to/your/file"' \
  -F 'uploadPath="images/user-uploads"' \
  -F 'fileName="my-image.jpg"'
```

**Python 示例：**

```python
import requests

headers = {"Authorization": "Bearer YOUR_API_KEY"}

with open("source.jpg", "rb") as f:
    resp = requests.post(
        "https://kieai.redpandaai.co/api/file-stream-upload",
        headers=headers,
        files={"file": f},
        data={"uploadPath": "image-to-image", "fileName": "source.jpg"}
    )
result = resp.json()
source_url = result["data"]["downloadUrl"]
print(f"上传成功，下载链接: {source_url}")
# source_url 可直接传入图生图接口的 input_urls 参数
```

> ⚠️ 上传文件为**临时文件，3 天后自动删除**。推荐用于 >10MB 的大文件，比 Base64 上传效率高约 33%。

***

## 三种上传方式对比

| 对比项  | 文件流上传（本接口）      | Base64 上传       | URL 上传   |
| ---- | --------------- | --------------- | -------- |
| 适用场景 | 大文件（>10MB）      | 小文件             | 远程文件     |
| 传输效率 | 比 Base64 高约 33% | 较低（Base64 编码膨胀） | 依赖源站速度   |
| 上传方式 | 二进制流直接传输        | Base64 编码字符串    | 提供文件 URL |

