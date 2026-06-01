# conftest.py 模板大全

FastAPI 测试中最常用的 pytest fixture 模板，覆盖数据库隔离、认证客户端、Mock 外部服务、测试数据工厂等场景。

---

## 1. 基础同步测试客户端

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """同步测试客户端 - 无需认证"""
    return TestClient(app)


@pytest.fixture
def auth_client(client):
    """已认证的同步测试客户端"""
    # 方式1: 直接设置 Authorization header
    # token = create_test_token(user_id="test_user")
    # client.headers.update({"Authorization": f"Bearer {token}"})
    
    # 方式2: 通过登录接口获取 token
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "testpass123",
    })
    token = response.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
```

## 2. 异步测试客户端（推荐）

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def async_client():
    """异步测试客户端 - 无需认证"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def auth_client(async_client):
    """已认证的异步测试客户端"""
    response = await async_client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "testpass123",
    })
    token = response.json()["access_token"]
    async_client.headers.update({"Authorization": f"Bearer {token}"})
    return async_client
```

## 3. 数据库隔离（SQLAlchemy + async）

```python
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.base import Base
from app.core.config import settings


# 使用 SQLite 内存数据库做测试
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    """创建 session 级别的事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """测试数据库引擎 - session 级别，所有测试共享"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine):
    """每个测试独立的数据库会话 - 事务回滚隔离"""
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()


@pytest.fixture
async def db_client(test_engine, db_session):
    """带数据库依赖注入覆盖的异步测试客户端"""
    from app.api.deps import get_db
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()
```

## 4. 数据库隔离（SQLAlchemy + 同步）

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.models.base import Base
from app.main import app
from app.api.deps import get_db


TEST_DATABASE_URL = "sqlite:///./test.db"


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DATABASE_URL, echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """每个测试独立事务"""
    TestingSessionLocal = sessionmaker(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db_session):
    """覆盖数据库依赖的测试客户端"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

## 5. 数据库隔离（Tortoise ORM）

```python
import pytest
from tortoise import Tortoise
from fastapi.testclient import TestClient
from app.main import app


TEST_DB_URL = "sqlite://:memory:"


@pytest.fixture(autouse=True)
async def init_db():
    """每个测试前后初始化/清理 Tortoise ORM"""
    await Tortoise.init(
        db_url=TEST_DB_URL,
        modules={"models": ["app.models"]},
    )
    await Tortoise.generate_schemas()
    yield
    await Tortoise._drop_databases()
```

## 6. JWT 认证 Fixture

```python
import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.core.config import settings


def create_test_token(user_id: str = "test_user", exp_hours: int = 1, **extra_claims) -> str:
    """生成测试用 JWT token"""
    expire = datetime.now(timezone.utc) + timedelta(hours=exp_hours)
    payload = {
        "sub": user_id,
        "exp": expire,
        **extra_claims,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@pytest.fixture
def test_token():
    """生成测试用 JWT token"""
    return create_test_token()


@pytest.fixture
def expired_token():
    """生成过期的 JWT token"""
    return create_test_token(exp_hours=-1)


@pytest.fixture
def auth_headers(test_token):
    """带 Authorization 的请求头"""
    return {"Authorization": f"Bearer {test_token}"}
```

## 7. 测试数据工厂

```python
import pytest
from app.models.user import User
from app.models.item import Item


@pytest.fixture
async def test_user(db_session):
    """创建测试用户"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="$2b$12$fakehashedpassword",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def test_item(db_session, test_user):
    """创建测试条目"""
    item = Item(
        title="Test Item",
        description="A test item",
        owner_id=test_user.id,
    )
    db_session.add(item)
    await db_session.flush()
    return item


@pytest.fixture
async def multiple_items(db_session, test_user):
    """创建多个测试条目"""
    items = []
    for i in range(5):
        item = Item(
            title=f"Item {i}",
            description=f"Test item {i}",
            owner_id=test_user.id,
        )
        db_session.add(item)
        items.append(item)
    await db_session.flush()
    return items
```

## 8. Mock 外部服务

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.fixture
def mock_redis():
    """Mock Redis 客户端"""
    with patch("app.core.cache.redis_client") as mock:
        mock.get = AsyncMock(return_value=None)
        mock.set = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=1)
        yield mock


@pytest.fixture
def mock_email_service():
    """Mock 邮件发送服务"""
    with patch("app.services.email.send_email", new_callable=AsyncMock) as mock:
        mock.return_value = {"status": "sent", "message_id": "test_msg_id"}
        yield mock


@pytest.fixture
def mock_email_failure():
    """Mock 邮件发送失败"""
    with patch("app.services.email.send_email", new_callable=AsyncMock) as mock:
        mock.side_effect = ConnectionError("SMTP server unavailable")
        yield mock


@pytest.fixture
def mock_celery():
    """Mock Celery 异步任务"""
    with patch("app.tasks.celery_app.send_task") as mock:
        mock.return_value = MagicMock(id="test_task_id")
        yield mock


@pytest.fixture
def mock_s3_upload():
    """Mock S3 文件上传"""
    with patch("app.services.storage.s3_client.upload_file") as mock:
        mock.return_value = "https://test-bucket.s3.amazonaws.com/test-key"
        yield mock
```

## 9. 环境变量覆盖

```python
import pytest
import os


@pytest.fixture
def test_env():
    """覆盖环境变量为测试配置"""
    original_env = os.environ.copy()
    test_vars = {
        "APP_ENV": "test",
        "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
        "SECRET_KEY": "test-secret-key-for-testing-only",
        "DEBUG": "true",
        "REDIS_URL": "redis://localhost:6379/15",  # 使用 15 号库避免冲突
    }
    os.environ.update(test_vars)
    yield
    os.environ.clear()
    os.environ.update(original_env)
```

## 10. 完整生产级 conftest 示例

```python
"""
conftest.py - FastAPI 测试配置

包含：
- 异步测试客户端
- 数据库隔离（事务回滚）
- 认证 fixture
- 测试数据工厂
- Mock 外部服务
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.models.base import Base
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.security import get_password_hash


# ── 事件循环 ──────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── 数据库 ────────────────────────────────────────────
TEST_DB = "sqlite+aiosqlite:///./test.db"

@pytest.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DB, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture
async def db(engine):
    """独立事务的数据库会话"""
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()


# ── 测试用户 ──────────────────────────────────────────
@pytest.fixture
async def test_user(db):
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


# ── 客户端 ────────────────────────────────────────────
@pytest.fixture
async def client(db, test_user):
    """带 DB 注入覆盖的异步客户端"""
    async def override_get_db():
        yield db

    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
async def anon_client(db):
    """未认证的异步客户端"""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
```
