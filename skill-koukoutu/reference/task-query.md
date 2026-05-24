# 任务查询轮询

异步任务提交后，通过轮询接口获取处理结果。

---

## 接口信息

| 项目 | 内容 |
|------|------|
| **接口地址** | `POST https://async.koukoutu.com/v1/query` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **建议轮询频率** | 每 **1 秒** 一次 |
| **并发限制** | 同时最多 **5 个** 任务 |

---

## 请求参数

### Header 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-API-Key` | string | 是 | API 密钥 |

### Body 参数

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `task_id` | integer | 是 | `123` | 异步任务 ID（由 create 接口返回） |
| `response` | string | 是 | `url` | 返回格式 |
| `model_key` | string | 是 | `image-extract` | 模型标识（需与提交时一致） |

### model_key 对应关系

| 功能 | model_key 值 |
|------|-------------|
| 印花提取 | `image-extract` |
| 通用抠图 | `background-removal` |
| 印花抠图 | `stamp-background-removal` |

---

## cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/query' \
--header 'X-API-Key: api 密钥' \
--data-urlencode 'task_id=123' \
--data-urlencode 'response=url' \
--data-urlencode 'model_key=image-extract'
```

---

## 返回响应

### 任务运行中（HTTP 200）

```json
{
    "code": 200,
    "message": "running",
    "data": {
        "state": 0,
        "result_file": null,
        "message": null,
        "progress": "65.71",
        "position": -1
    }
}
```

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | integer | 状态码，200 表示请求成功 |
| `message` | string | 状态描述：`running`（运行中）/ `success`（已完成） |
| `data.state` | integer | 任务状态：`0` = 运行中，完成状态值待确认 |
| `data.result_file` | string \| null | 结果文件地址，任务未完成时为 `null` |
| `data.message` | string \| null | 附加消息 |
| `data.progress` | string | 任务进度百分比（如 `"65.71"` = 65.71%） |
| `data.position` | integer | 排队位置，`-1` 表示不在队列中等待 |

---

## 轮询逻辑伪代码

```python
import time
import requests

def poll_result(api_key: str, task_id: int, model_key: str, max_attempts: int = 60) -> str:
    """轮询查询异步任务结果"""
    for i in range(max_attempts):
        resp = requests.post(
            "https://async.koukoutu.com/v1/query",
            headers={"X-API-Key": api_key},
            data={"task_id": task_id, "response": "url", "model_key": model_key},
        )
        result = resp.json()
        if result.get("data", {}).get("result_file"):
            return result["data"]["result_file"]
        time.sleep(1)
    raise TimeoutError(f"任务 {task_id} 在 {max_attempts} 秒内未完成")
```

---

## 注意事项

- `model_key` 必须与提交任务时使用的值一致
- `result_file` 为 `null` 表示任务尚未完成，需继续轮询
- `progress` 字段可用于显示进度条
- `position` 为非 -1 值时表示任务在排队等待
