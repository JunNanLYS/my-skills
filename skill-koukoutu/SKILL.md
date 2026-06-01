---
name: skill-koukoutu
description: 扣扣图（KouKouTu）API 集成技能，提供印花提取、通用抠图、印花抠图三类异步图像处理能力。触发词：抠图、去背景、去底、提取印花、印花抠图、背景移除、background removal、image extract、koukoutu、扣扣图
---

# 扣扣图（KouKouTu）API 技能

> **渐进式披露设计**：本文件是核心索引，始终加载。详细 API 参考按需加载。
>
> - 🖼️ 通用抠图（background-removal）完整参数 → 加载 `reference/background-removal.md`
> - 🌸 印花抠图（stamp-background-removal）完整参数 → 加载 `reference/stamp-removal.md`
> - 🎨 印花提取（image-extract）完整参数 → 加载 `reference/image-extract.md`
> - 🔄 任务查询轮询完整参数 → 加载 `reference/task-query.md`

---

## 概览

扣扣图是一个异步图像处理 API，提供三大功能：

| 功能 | model_key | 说明 |
|------|-----------|------|
| 通用抠图 | `background-removal` | 移除图片背景，输出透明图 |
| 印花抠图 | `stamp-background-removal` | 针对印花图案的专用抠图 |
| 印花提取 | `image-extract` | 从服装等物品中提取印花图案 |

---

## 核心调用流程

```
1. POST https://async.koukoutu.com/v1/create → 提交任务，获取 task_id
2. POST https://async.koukoutu.com/v1/query  → 轮询结果（建议 1 秒/次）
3. 获取 result_file → 处理完成
```

---

## 认证

所有请求 Header 必须携带：

```
X-API-Key: <你的 API 密钥>
```

---

## API 速查

### 提交任务 — POST `/v1/create`

所有功能共用同一端点，通过 `model_key` 区分：

| model_key | 图片输入方式 | Content-Type | 详细文档 |
|-----------|-------------|--------------|----------|
| `background-removal` | file 上传 | `multipart/form-data` | `reference/background-removal.md` |
| `background-removal` | URL | `application/x-www-form-urlencoded` | `reference/background-removal.md` |
| `background-removal` | base64 | `application/x-www-form-urlencoded` | `reference/background-removal.md` |
| `stamp-background-removal` | file 上传 | `multipart/form-data` | `reference/stamp-removal.md` |
| `stamp-background-removal` | URL | `application/x-www-form-urlencoded` | `reference/stamp-removal.md` |
| `stamp-background-removal` | base64 | `application/x-www-form-urlencoded` | `reference/stamp-removal.md` |
| `image-extract` | file 上传 | `multipart/form-data` | `reference/image-extract.md` |
| `image-extract` | URL | `application/x-www-form-urlencoded` | `reference/image-extract.md` |

### 查询结果 — POST `/v1/query`

| 参数 | 说明 |
|------|------|
| `task_id` | 异步任务 ID |
| `response` | 返回格式（`url`） |
| `model_key` | 对应模型标识 |

> 详细字段说明 → 加载 `reference/task-query.md`

---

## 通用规则

- ⏱️ **异步模式**：所有接口均为异步，提交后仅返回 `task_id`
- 🔄 **轮询频率**：建议每 **1 秒** 查询一次
- 🚦 **并发限制**：同时最多 **5 个** 并发任务
- 📦 **返回格式**：统一 JSON `{ code, message, data: { task_id } }`
- 🖼️ **图片输入**：支持 file / URL / base64 三种方式（印花提取仅支持 file 和 URL）

---

## AI 检查清单

- [ ] Header 携带 `X-API-Key`
- [ ] `model_key` 与功能匹配
- [ ] Content-Type 与图片输入方式匹配（file → multipart，URL/base64 → form-urlencoded）
- [ ] 提交后使用轮询接口查询结果
- [ ] 轮询间隔 ≥ 1 秒
- [ ] 并发任务 ≤ 5 个
- [ ] 印花提取的 `resolution` 和 `size` 参数已填写
