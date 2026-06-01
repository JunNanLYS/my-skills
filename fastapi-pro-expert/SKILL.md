---
name: fastapi-pro-expert
description: 专门用于构建高性能、异步 Python API 的开发指南。涵盖 Pydantic v2 最佳实践、依赖注入、异步数据库操作以及自动文档优化。
---

# FastAPI 开发核心原则

### 1. 异步与类型安全

- **优先使用 `async def`**：除非涉及到不支持异步的阻塞式 I/O（如某些旧版 ORM），否则一律使用异步定义路由。
- **严格类型提示**：所有路由函数的参数和返回值必须包含完整的类型提示（Type Hints），以便 FastAPI 自动生成准确的 OpenAPI 规格。

### 2. Pydantic v2 规范

- 使用 `from pydantic import BaseModel, Field, EmailStr` 等进行模型定义。
- **属性校验**：优先使用 `Field(..., description="...", example="...")` 增加文档的可读性。
- **配置项**：使用 `model_config = ConfigDict(from_attributes=True)` 代替旧版的 `class Config`。

### 3. 依赖注入 (DI) 系统

- 使用 `Annotated` 语法定义依赖，例如：`db: Annotated[Session, Depends(get_db)]`。
- 将通用逻辑（如用户认证、数据库连接）抽离到独立的 `dependencies.py` 模块中。

### 4. 项目结构与模块化

- **APIRouter**：大规模应用必须使用 `APIRouter` 进行版本控制和功能拆分。
- **异常处理**：使用 `HTTPException` 并配合自定义异常处理器，确保返回统一的 JSON 错误格式。

### 5. 性能与优化

- 使用 `response_model` 过滤输出数据，防止敏感字段泄漏。
- 中间件（Middleware）仅用于全局任务（如 CORS, GZip, 日志记录）。
- 利用 `BackgroundTasks` 处理非阻塞型后续任务。

# 常用代码片段参考

> **路由定义模板**
>
> ```python
> from fastapi import APIRouter, Depends, HTTPException, status
> from typing import Annotated
>
> router = APIRouter(prefix="/users", tags=["users"])
>
> @router.get("/{user_id}", response_model=UserRead)
> async def read_user(
>     user_id: int,
>     db: Annotated[Session, Depends(get_db)]
> ):
>     user = await db.get(User, user_id)
>     if not user:
>         raise HTTPException(status_code=404, detail="User not found")
>     return user
> ```
