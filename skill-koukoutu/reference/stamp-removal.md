# 印花抠图 — stamp-background-removal

针对印花图案的专用抠图模型，从印花图片中精确提取印花区域。

---

## 1. file 方式提交

- **接口地址**：`POST https://async.koukoutu.com/v1/create`
- **Content-Type**：`multipart/form-data`

### Header 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-API-Key` | string | 是 | API 密钥 |

### Body 参数

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `model_key` | string | 是 | `stamp-background-removal` | 固定值 |
| `image_file` | file | 是 | `@"/path/to/image"` | 上传的图片文件 |
| `output_format` | string | 否 | `webp` | 输出图片格式 |
| `crop` | string | 否 | `0` | 是否裁剪（0=否，1=是） |
| `border` | string | 否 | `0` | 是否添加边框（0=否，1=是） |
| `stamp_crop` | string | 否 | `0` | 是否印花裁剪（0=否，1=是） |

### cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/create' \
--header 'X-API-Key: api 密钥' \
--form 'model_key="stamp-background-removal"' \
--form 'image_file=@"/path/to/image"' \
--form 'output_format="webp"' \
--form 'crop="0"' \
--form 'border="0"' \
--form 'stamp_crop="0"'
```

---

## 2. URL 方式提交

- **接口地址**：`POST https://async.koukoutu.com/v1/create`
- **Content-Type**：`application/x-www-form-urlencoded`

### Header 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-API-Key` | string | 是 | API 密钥 |

### Body 参数

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `model_key` | string | 是 | `stamp-background-removal` | 固定值 |
| `image_url` | string | 是 | `https://www.test.com/123.jpg` | 图片 URL 地址 |
| `output_format` | string | 是 | `webp` | 输出图片格式 |
| `crop` | string | 是 | `0` | 是否裁剪 |
| `border` | string | 是 | `0` | 是否添加边框 |
| `stamp_crop` | string | 是 | `0` | 是否印花裁剪 |

### cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/create' \
--header 'X-API-Key: api 密钥' \
--data-urlencode 'model_key=stamp-background-removal' \
--data-urlencode 'image_url=https://www.test.com/123.jpg' \
--data-urlencode 'output_format=webp' \
--data-urlencode 'crop=0' \
--data-urlencode 'border=0' \
--data-urlencode 'stamp_crop=0'
```

---

## 3. base64 方式提交

- **接口地址**：`POST https://async.koukoutu.com/v1/create`
- **Content-Type**：`application/x-www-form-urlencoded`

### Header 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-API-Key` | string | 是 | API 密钥 |

### Body 参数

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `model_key` | string | 是 | `stamp-background-removal` | 固定值 |
| `image_base64` | string | 是 | `data:image/jpeg;base64,...` | 图片 base64 编码（含 Data URI 前缀） |
| `output_format` | string | 是 | `webp` | 输出图片格式 |
| `crop` | string | 是 | `0` | 是否裁剪 |
| `border` | string | 是 | `0` | 是否添加边框 |
| `stamp_crop` | string | 是 | `0` | 是否印花裁剪 |

### cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/create' \
--header 'X-API-Key: api 密钥' \
--data-urlencode 'model_key=stamp-background-removal' \
--data-urlencode 'image_base64=data:image/jpeg;base64,[base64 code]' \
--data-urlencode 'output_format=webp' \
--data-urlencode 'crop=0' \
--data-urlencode 'border=0' \
--data-urlencode 'stamp_crop=0'
```

---

## 参数选项参考

| 参数 | 可选值 | 说明 |
|------|--------|------|
| `output_format` | `webp`、`png` | 输出图片格式 |
| `crop` | `0`（否）、`1`（是） | 裁剪多余空白区域 |
| `border` | `0`（否）、`1`（是） | 添加边框 |
| `stamp_crop` | `0`（否）、`1`（是） | 印花裁剪（印花抠图建议设为 `1`） |

---

## 与通用抠图的区别

| 维度 | 通用抠图（background-removal） | 印花抠图（stamp-background-removal） |
|------|------|------|
| 适用场景 | 通用物品/人物去背景 | 印花图案专用抠图 |
| 边缘精度 | 标准精度 | 针对印花纹理优化 |
| stamp_crop | 通常为 0 | 建议设为 1 |

---

## 返回响应

所有方式返回格式一致：

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "task_id": 176
    }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | integer | 状态码，200 表示成功 |
| `message` | string | 状态信息 |
| `data.task_id` | integer | 异步任务 ID，用于轮询查询 |

> 获取 `task_id` 后，调用 `reference/task-query.md` 中的轮询接口获取结果。
