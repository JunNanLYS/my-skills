# 印花提取 — image-extract

从服装等物品图片中提取印花图案，支持指定分辨率和尺寸比例。

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
| `model_key` | string | 是 | `image-extract` | 固定值 |
| `image_file` | file | 是 | `@"/path/to/image"` | 上传的图片文件 |
| `resolution` | string | 是 | `1k` | 输出分辨率 |
| `size` | string | 是 | `3:4` | 输出尺寸比例 |
| `extract_type` | string | 是 | `服装` | 提取类型 |

### cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/create' \
--header 'X-API-Key: api 密钥' \
--form 'model_key="image-extract"' \
--form 'image_file=@"/path/to/image"' \
--form 'resolution="1k"' \
--form 'size="3:4"' \
--form 'extract_type="服装"'
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
| `model_key` | string | 是 | `image-extract` | 固定值 |
| `image_url` | string | 是 | `https://www.test.com/123.jpg` | 图片 URL 地址 |
| `resolution` | string | 是 | `1k` | 输出分辨率 |
| `size` | string | 是 | `3:4` | 输出尺寸比例 |
| `extract_type` | string | 是 | — | 提取类型（注：URL 方式文档未明确该参数，建议测试验证） |

### cURL 示例

```bash
curl --location --request POST 'https://async.koukoutu.com/v1/create' \
--header 'X-API-Key: api 密钥' \
--data-urlencode 'model_key=image-extract' \
--data-urlencode 'image_url=https://www.test.com/123.jpg' \
--data-urlencode 'resolution=1k' \
--data-urlencode 'size=3:4'
```

---

## 专有参数说明

印花提取与通用/印花抠图不同，不含 `output_format`、`crop`、`border`、`stamp_crop`，而是使用以下专有参数：

| 参数 | 必填 | 示例值 | 说明 |
|------|------|--------|------|
| `resolution` | 是 | `1k` | 输出分辨率 |
| `size` | 是 | `3:4` | 输出尺寸比例（宽:高） |
| `extract_type` | 是（file 方式） | `服装` | 提取类型 |

### resolution 选项参考

| 值 | 说明 |
|----|------|
| `1k` | 标准分辨率 |
| （其他值待确认） | 可能有 `2k` 等选项 |

### size 选项参考

| 值 | 说明 |
|----|------|
| `3:4` | 竖版（3 宽 : 4 高） |
| `1:1` | 正方形 |
| `4:3` | 横版 |
| （其他比例待确认） | — |

---

## 返回响应

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

> ⚠️ 印花提取**不支持 base64 方式**提交，仅支持 file 和 URL。
>
> 获取 `task_id` 后，调用 `reference/task-query.md` 中的轮询接口获取结果，轮询时 `model_key` 需传 `image-extract`。
