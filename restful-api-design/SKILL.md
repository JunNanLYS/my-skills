---
name: restful-api-design
description: RESTful API 设计与审查技能，用于设计、重构、评审或编写符合 REST 约定的 HTTP API、OpenAPI 文档、接口命名、资源模型、状态码、错误响应、分页筛选排序、认证授权、版本控制、兼容性策略和生产环境折中方案。触发词：REST、RESTful、API 规范、接口设计、接口评审、OpenAPI、Swagger、HTTP 状态码、资源建模、分页、幂等、错误码、防火墙限制、多资源操作、业务流程 API
---

# RESTful API Design

## 目标

使用该技能设计或审查 HTTP API 时，优先输出面向资源、语义清晰、可缓存、可分页、可演进且易于生成 OpenAPI 文档的 RESTful API。

当需要更完整的规范、示例或检查表时，读取 `references/restful-standards.md`。

## 工作流程

1. 先识别业务资源、资源关系、主要用例和调用方。
2. 将动作型需求转成资源状态变化，只有在确实不是资源操作时才使用动作端点。
3. 为每个用例选择正确的 HTTP 方法、路径、状态码、请求体和响应体。
4. 补齐跨接口一致规则：认证、错误模型、分页、筛选、排序、并发控制、幂等、版本控制和审计字段。
5. 输出接口表、关键请求/响应示例，以及必要的 OpenAPI 片段或评审意见。

## 资源建模

- 使用名词复数作为集合资源：`/users`、`/orders`、`/invoices`。
- 使用层级表达强归属关系：`/orders/{orderId}/items`。
- 避免在路径中使用动词：优先 `POST /orders/{orderId}/cancellations`，而不是 `POST /orders/{orderId}/cancel`。
- 控制嵌套深度，通常不超过 2 层；复杂查询改用查询参数或专门的搜索资源。
- 路径使用 kebab-case 或小写单词，保持项目内一致：`/audit-logs`、`/api-keys`。
- 资源 ID 使用稳定、不泄露业务敏感信息的标识；明确 ID 格式，如 UUID、ULID、Snowflake。

## HTTP 方法

| 方法 | 用途 | 幂等性 |
|------|------|--------|
| `GET` | 读取集合或单个资源 | 是 |
| `POST` | 创建资源、提交命令、启动异步任务 | 否，除非使用幂等键 |
| `PUT` | 整体替换指定资源 | 是 |
| `PATCH` | 部分更新资源 | 取决于补丁语义 |
| `DELETE` | 删除资源或创建删除状态 | 是 |

不要用 `GET` 执行有副作用的操作。不要用 `POST` 代替所有方法，除非调用方或基础设施确有限制。

## 生产折中

RESTful 是默认设计语言，不是必须牺牲可用性的教条。遇到企业网关、WAF、代理、防火墙或客户端只允许 `GET`/`POST` 的场景时，可以用 `POST` 承载更新和删除，但必须保持资源语义、权限校验、幂等策略、状态码和错误模型一致。

优先方案：

1. 基础设施允许时，继续使用 `PUT`、`PATCH`、`DELETE`。
2. 基础设施限制方法时，使用 `POST` + 方法覆盖头：`X-HTTP-Method-Override: PATCH` 或 `X-HTTP-Method-Override: DELETE`。
3. 方法覆盖不可用时，把操作建模为资源：`POST /users/{userId}/deletion-requests`、`POST /orders/{orderId}/cancellations`。
4. 不要使用有副作用的 `GET` 作为兼容方案。

一次请求可以影响多个资源。判断标准不是“只能操作一个表”，而是客户端意图是否有清晰的业务边界。创建用户并分配角色可以设计为：

- `POST /users`，在请求体中携带 `roleIds`，当角色分配是创建用户的一部分。
- `POST /users/{userId}/role-assignments`，当角色分配是独立资源。
- `POST /user-onboarding-jobs` 或 `POST /registrations`，当创建用户、分配角色、发送通知、初始化权限需要作为一个业务流程或事务处理。

对多资源写操作，必须明确事务边界：全部成功、部分成功如何表达，失败是否回滚，是否异步，重试是否安全，是否需要 `Idempotency-Key`。

## 状态码

| 场景 | 推荐状态码 |
|------|------------|
| 查询成功 | `200 OK` |
| 创建成功 | `201 Created` + `Location` |
| 同步更新成功且返回资源 | `200 OK` |
| 同步更新/删除成功且无响应体 | `204 No Content` |
| 异步任务已接受 | `202 Accepted` |
| 请求格式或字段非法 | `400 Bad Request` |
| 未认证 | `401 Unauthorized` |
| 已认证但无权限 | `403 Forbidden` |
| 资源不存在 | `404 Not Found` |
| 方法不支持 | `405 Method Not Allowed` |
| 资源冲突或状态冲突 | `409 Conflict` |
| 前置条件失败 | `412 Precondition Failed` |
| 语义校验失败 | `422 Unprocessable Entity` |
| 限流 | `429 Too Many Requests` |
| 服务端异常 | `500 Internal Server Error` |

## 请求与响应

- 默认使用 `application/json; charset=utf-8`。
- 请求体字段使用一致命名风格，推荐 `camelCase` 或项目既有风格。
- 时间使用 ISO 8601 UTC：`2026-05-24T12:30:00Z`。
- 金额避免浮点数，使用最小货币单位或字符串十进制定点数，并携带币种。
- 响应体不要包裹无意义的统一外壳；如项目已有 `{ code, message, data }` 约定，可保留并统一错误语义。
- 集合接口返回分页元数据和稳定排序依据。

## 错误模型

优先使用一致、可机器处理、可定位字段的错误结构：

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "requestId": "req_01HZY...",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Email format is invalid."
    }
  ]
}
```

错误响应必须避免泄露密钥、SQL、堆栈、内部主机名和用户隐私数据。

## 查询能力

- 分页：优先游标分页 `?limit=20&cursor=...`；简单后台列表可用 `?page=1&pageSize=20`。
- 排序：使用 `?sort=-createdAt,name`，负号表示降序。
- 筛选：使用明确字段：`?status=paid&createdFrom=...&createdTo=...`。
- 字段选择：需要时支持 `?fields=id,name,status`。
- 关联展开：谨慎使用 `?include=customer,items`，并限制展开深度。

## 安全与兼容性

- 所有生产 API 使用 HTTPS。
- 认证推荐 `Authorization: Bearer <token>`；服务间调用可用 OAuth2 client credentials、mTLS 或签名请求。
- 写操作考虑幂等键：`Idempotency-Key`。
- 更新操作考虑乐观锁：`ETag`、`If-Match` 或版本号。
- 限流响应包含 `Retry-After`，必要时包含剩余额度头。
- 版本优先放在 URL 前缀或媒体类型中，并在项目内统一：`/v1/orders`。
- 新增可选字段通常兼容；删除字段、改类型、改语义、收紧校验通常是破坏性变更。

## 输出格式

设计 API 时，优先输出：

1. 资源模型与关系说明。
2. 接口清单表：方法、路径、用途、请求、响应、状态码。
3. 关键接口的 JSON 示例。
4. 错误响应、分页、鉴权、幂等和版本策略。
5. 如用户要求，补充 OpenAPI 3.1 YAML 片段。

审查 API 时，优先输出：

1. 按严重程度排序的问题清单。
2. 每个问题给出违反的 REST 原则、影响和建议改法。
3. 提供修正后的端点命名、状态码或响应示例。

## 快速检查

- [ ] 路径是否以资源名词为中心，避免动词。
- [ ] 方法是否符合 HTTP 语义和幂等性。
- [ ] 状态码是否能准确表达结果。
- [ ] 错误响应是否统一且可机器处理。
- [ ] 分页、筛选、排序是否一致。
- [ ] 创建、更新、删除是否考虑并发、幂等和审计。
- [ ] 企业网络限制 HTTP 方法时，是否提供安全的 `POST` 兼容方案。
- [ ] 多资源操作是否建模为聚合资源、关系资源或业务流程资源。
- [ ] API 是否可演进，破坏性变更是否有版本策略。
- [ ] OpenAPI 文档是否与实际行为一致。
