---
name: skill-fastapi
description: FastAPI + SQLModel 后端编码规范，包含项目结构、数据库设计、路由、服务层、模型层、异常处理、测试等，编辑后端时必须遵守。
---

# FastAPI + SQLModel 后端编码规范

> **渐进式披露设计**：本文件是核心索引，始终加载。详细模板按需加载。
>
> - 📦 CRUD 代码模板 → 加载 `reference/templates.md`

## 技术栈

Python + FastAPI + SQLModel + pydantic-settings + Alembic

---

## 1. 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # pydantic-settings 配置
│   ├── database.py          # 引擎 + get_session
│   ├── dependencies.py      # 公共依赖注入
│   ├── exceptions.py        # 自定义异常 + 全局处理器
│   ├── models/              # SQLModel 数据模型（table=True）
│   ├── schemas/             # Pydantic 请求/响应模型
│   ├── routers/             # API 路由（按模块）
│   ├── services/            # 业务逻辑层
│   └── utils/               # 工具函数
├── tests/
├── alembic/
├── requirements.txt
└── .env / .env.example
```

**分层架构**：Router → Service → Model，严禁 Router 中写业务逻辑。

---

## 2. 配置管理

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "MyApp"
    DATABASE_URL: str = "sqlite:///./app.db"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- ❌ 禁止硬编码配置值
- ❌ 禁止 `.env` 入库

---

## 3. 数据库

```python
# app/database.py
from sqlmodel import SQLModel, create_engine, Session
from app.config import get_settings

engine = create_engine(get_settings().DATABASE_URL, echo=get_settings().DEBUG, pool_pre_ping=True)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
```

### Model 规则

```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    username: str = Field(unique=True, index=True, max_length=50)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

- ✅ 主键用 UUID 或 int
- ✅ 查询字段加 `index=True`，唯一字段加 `unique=True`
- ✅ 字符串字段必须设 `max_length`
- ✅ 必须包含 `created_at` / `updated_at`
- ✅ 用 `default_factory`，禁止可变默认值
- ❌ 禁止 `datetime.now()`（用 `datetime.utcnow`）
- ❌ 禁止模型中包含业务方法

---

## 4. Schema 规则

```python
# Create / Update / Response 分离
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime
    class Config:
        from_attributes = True
```

- ✅ Create/Update/Response 分离
- ✅ Response 排除敏感字段（password 等）
- ✅ Update 所有字段 Optional
- ✅ 列表返回分页信息（total, page, page_size）
- ✅ 设置 `from_attributes = True`
- ❌ 禁止 Schema 中包含业务逻辑

---

## 5. Service 规则

```python
class UserService:
    @staticmethod
    def create(session: Session, data: UserCreate) -> User:
        user = User(**data.model_dump())
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    @staticmethod
    def get_by_id(session: Session, user_id: str) -> Optional[User]:
        return session.get(User, user_id)

    @staticmethod
    def get_list(session: Session, page: int = 1, page_size: int = 10) -> tuple[list[User], int]:
        query = select(User)
        total = session.exec(select(func.count(User.id))).one()
        items = session.exec(query.offset((page - 1) * page_size).limit(page_size)).all()
        return items, total

    @staticmethod
    def update(session: Session, user_id: str, data: UserUpdate) -> Optional[User]:
        user = session.get(User, user_id)
        if not user: return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(user, key, value)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    @staticmethod
    def delete(session: Session, user_id: str) -> bool:
        user = session.get(User, user_id)
        if not user: return False
        session.delete(user)
        session.commit()
        return True
```

- ✅ 方法参数：第一个 `session`，第二个数据模型
- ✅ 用 `model_dump(exclude_unset=True)` 处理部分更新
- ✅ 修改后必须 `commit()`，新增后必须 `refresh()`
- ✅ 分页查询同时返回数据和总数
- ❌ 禁止在 Service 中抛出 HTTPException（用 ValueError）
- ❌ 禁止在 Service 中处理 HTTP 请求/响应

---

## 6. Router 规则

```python
router = APIRouter(prefix="/users", tags=["用户管理"])

@router.post("/", response_model=UserResponse, status_code=201)
def create(data: UserCreate, session: Session = Depends(get_session)):
    try:
        return UserService.create(session, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{user_id}", response_model=UserResponse)
def get_by_id(user_id: str, session: Session = Depends(get_session)):
    user = UserService.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

@router.delete("/{user_id}", status_code=204)
def delete(user_id: str, session: Session = Depends(get_session)):
    if not UserService.delete(session, user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
```

- ✅ 必须设 `prefix`、`tags`、`response_model`
- ✅ 创建返回 201，删除返回 204
- ✅ 查询参数用 `Query` 设约束
- ✅ 通过 `Depends(get_session)` 注入会话
- ✅ 路由函数只做异常转换，业务交给 Service
- ❌ 禁止路由中直接操作数据库
- ❌ 禁止路由函数超过 20 行

---

## 7. 统一响应格式

```json
{ "code": 200, "message": "success", "data": { ... } }
```

---

## 8. 异常处理

```python
class AppException(Exception):
    def __init__(self, message: str, code: int = 400):
        self.message = message
        self.code = code

# 全局处理器注册在 main.py
@app.exception_handler(AppException)
async def handler(request, exc):
    return JSONResponse(status_code=exc.code,
        content={"code": exc.code, "message": exc.message, "data": None})
```

---

## 9. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | snake_case | `user_service.py` |
| 类名 | PascalCase | `UserService` |
| 函数名 | snake_case | `get_user_list` |
| 数据库表名 | snake_case 复数 | `users` |
| API 路径 | kebab-case 复数 | `/api/v1/user-profiles` |

### 导入顺序

```python
# 1. 标准库
import uuid
from datetime import datetime
# 2. 第三方库
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
# 3. 项目内部
from app.database import get_session
from app.models.user import User
```

- ✅ 所有函数必须有类型注解和 docstring
- ✅ 使用 Python 3.10+ 风格：`dict[str, Any]`

---

## 10. AI 检查清单

生成后端代码时，必须逐项检查：

- [ ] 分层架构 Router → Service → Model
- [ ] 模型包含 `id`、`created_at`、`updated_at`
- [ ] 字符串字段有 `max_length`
- [ ] Schema Create/Update/Response 分离
- [ ] Response 排除敏感字段
- [ ] Service 只抛通用异常（ValueError / AppException）
- [ ] Router 只做异常转换，无业务逻辑
- [ ] 所有函数有类型注解和 docstring
- [ ] 使用 `Depends(get_session)` 注入
- [ ] 正确的 HTTP 状态码（201/204/404）
- [ ] 导入顺序：标准库 → 第三方 → 项目内部
- [ ] 命名符合 snake_case / PascalCase 规范
