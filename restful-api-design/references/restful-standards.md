# RESTful API Standards Reference

## Endpoint Patterns

| 需求 | 推荐端点 | 避免 |
|------|----------|------|
| 创建订单 | `POST /orders` | `POST /createOrder` |
| 获取订单 | `GET /orders/{orderId}` | `GET /getOrder?id=...` |
| 修改订单地址 | `PATCH /orders/{orderId}/shipping-address` | `POST /orders/{orderId}/updateAddress` |
| 取消订单 | `POST /orders/{orderId}/cancellations` | `POST /orders/{orderId}/cancel` |
| 支付订单 | `POST /orders/{orderId}/payments` | `POST /payOrder` |
| 查询日志 | `GET /audit-logs?actorId=...` | `POST /queryAuditLogs` |
| 批量导入 | `POST /import-jobs` | `POST /batchImportUsers` |

动作可以建模为资源时，优先把动作名词化：`payments`、`cancellations`、`exports`、`import-jobs`、`password-reset-requests`。

## Production Compromises

RESTful API in production should favor clear contracts over formal purity. If infrastructure blocks `PUT`、`PATCH`、`DELETE`, do not fall back to side-effecting `GET`. Use one of these patterns.

### Method Override

Use this when gateways allow `POST` but the server can still preserve method semantics internally.

```http
POST /v1/users/usr_123
Content-Type: application/json
X-HTTP-Method-Override: PATCH
If-Match: "v4"
```

```json
{
  "displayName": "Alice Chen"
}
```

Document that the effective method is `PATCH`, keep the same validation, authorization, concurrency control, and response status that the native `PATCH` endpoint would use.

For delete:

```http
POST /v1/users/usr_123
X-HTTP-Method-Override: DELETE
```

Return `204 No Content` for a completed synchronous deletion, or `202 Accepted` with a task resource if deletion is asynchronous.

### Operation As Resource

Use this when method override is unavailable, or when the operation has its own lifecycle.

| 需求 | 推荐端点 | 说明 |
|------|----------|------|
| 删除用户 | `POST /users/{userId}/deletion-requests` | 删除需要审批、异步清理或审计 |
| 取消订单 | `POST /orders/{orderId}/cancellations` | 取消动作本身有原因、状态和结果 |
| 重置密码 | `POST /password-reset-requests` | 请求本身是资源 |
| 导出数据 | `POST /export-jobs` | 长任务建模为 job |

This is still RESTful when the API exposes a meaningful resource instead of an RPC verb.

## Multi-Resource Operations

REST does not require one HTTP request to modify only one database row or one resource type. Model the request around the business boundary.

### Aggregate Creation

Use one endpoint when child data is part of creating the aggregate.

```http
POST /v1/users
Content-Type: application/json
Idempotency-Key: 2e7b9b5b-81c1-43a6-87c4-5a815efb65de
```

```json
{
  "email": "alice@example.com",
  "displayName": "Alice",
  "roleIds": ["role_admin"]
}
```

Return the created user and its role assignments if callers need to confirm the full result.

```http
201 Created
Location: /v1/users/usr_123
```

```json
{
  "id": "usr_123",
  "email": "alice@example.com",
  "displayName": "Alice",
  "roles": [
    {
      "id": "role_admin",
      "name": "Admin"
    }
  ],
  "createdAt": "2026-05-24T12:30:00Z"
}
```

### Relationship Resource

Use a relationship resource when the user already exists and role assignment is independently managed.

```http
POST /v1/users/usr_123/role-assignments
Content-Type: application/json
```

```json
{
  "roleId": "role_admin"
}
```

Return `201 Created` with a `Location` header such as `/v1/users/usr_123/role-assignments/role_admin`.

### Business Process Resource

Use a process resource when one request coordinates multiple resources, side effects, or transactional steps.

```http
POST /v1/user-onboarding-jobs
Content-Type: application/json
Idempotency-Key: 5972eb8f-8eb7-4f5d-a518-4a1190d2b30c
```

```json
{
  "user": {
    "email": "alice@example.com",
    "displayName": "Alice"
  },
  "roleIds": ["role_admin"],
  "sendWelcomeEmail": true
}
```

For synchronous completion, return `201 Created` with the resulting user or onboarding record. For long-running work, return `202 Accepted` and expose `/v1/user-onboarding-jobs/{jobId}`.

Always document:

- Whether the operation is atomic.
- What happens when one step fails.
- Whether retries are safe.
- Which resource should be used to query the final result.
- Which events, emails, audit logs, or external calls may be triggered.

## Standard Collection Response

```json
{
  "items": [
    {
      "id": "ord_123",
      "status": "paid",
      "createdAt": "2026-05-24T12:30:00Z"
    }
  ],
  "pageInfo": {
    "limit": 20,
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2...",
    "hasMore": true
  }
}
```

游标分页适合高并发和大数据集合；页码分页适合数据量较小、允许跳页的后台列表。

## Create Resource

Request:

```http
POST /v1/orders
Content-Type: application/json
Idempotency-Key: 2e7b9b5b-81c1-43a6-87c4-5a815efb65de
```

```json
{
  "customerId": "cus_123",
  "items": [
    {
      "skuId": "sku_001",
      "quantity": 2
    }
  ]
}
```

Response:

```http
201 Created
Location: /v1/orders/ord_123
```

```json
{
  "id": "ord_123",
  "customerId": "cus_123",
  "status": "pending",
  "createdAt": "2026-05-24T12:30:00Z",
  "updatedAt": "2026-05-24T12:30:00Z"
}
```

## Partial Update

Use `PATCH` when updating selected fields. Accept either a simple merge body or a formal patch format, and document which one is supported.

```http
PATCH /v1/orders/ord_123
Content-Type: application/json
If-Match: "v3"
```

```json
{
  "shippingAddress": {
    "line1": "100 Market St",
    "city": "San Francisco",
    "country": "US"
  }
}
```

Return `200 OK` with the updated resource, or `204 No Content` when callers do not need the body.

## Async Operations

For long-running work, return `202 Accepted` and expose a task resource.

```http
POST /v1/export-jobs
Content-Type: application/json
```

```json
{
  "resource": "orders",
  "format": "csv",
  "createdFrom": "2026-05-01T00:00:00Z"
}
```

```http
202 Accepted
Location: /v1/export-jobs/job_123
```

```json
{
  "id": "job_123",
  "status": "queued",
  "createdAt": "2026-05-24T12:30:00Z"
}
```

Task states should be explicit: `queued`、`running`、`succeeded`、`failed`、`canceled`。

## Error Catalog

| HTTP 状态码 | 示例错误码 | 使用场景 |
|-------------|------------|----------|
| `400` | `malformed_json` | JSON 无法解析、查询参数格式错误 |
| `401` | `missing_token` | 缺少或无效认证 |
| `403` | `insufficient_scope` | 认证有效但权限不足 |
| `404` | `resource_not_found` | 资源不存在或不可见 |
| `409` | `state_conflict` | 当前状态不允许操作 |
| `412` | `etag_mismatch` | `If-Match` 不匹配 |
| `422` | `validation_failed` | 字段语义校验失败 |
| `429` | `rate_limited` | 超过限流策略 |

## OpenAPI Requirements

生成 OpenAPI 3.1 文档时，至少包含：

- `openapi`、`info`、`servers`。
- 每个操作的 `operationId`、`summary`、`tags`。
- 路径参数、查询参数、请求体 schema、响应 schema。
- 统一错误 schema。
- 安全方案：`bearerAuth`、`oauth2`、`apiKey` 或项目要求的方案。
- 示例请求和示例响应。

Example:

```yaml
openapi: 3.1.0
info:
  title: Orders API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
security:
  - bearerAuth: []
paths:
  /orders:
    get:
      operationId: listOrders
      summary: List orders
      tags: [Orders]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        "200":
          description: Orders returned
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Review Rubric

Use this rubric when reviewing an API:

| Severity | Criteria |
|----------|----------|
| P0 | Security issue, destructive `GET`, auth bypass, data leak, undocumented breaking behavior |
| P1 | Wrong resource model, wrong method semantics, inconsistent status codes, non-idempotent retry risk |
| P2 | Inconsistent naming, incomplete errors, missing pagination metadata, weak validation detail |
| P3 | Documentation polish, examples, naming clarity, minor consistency improvements |

Lead with concrete issues, not general style preferences.
