# FastAPI 测试模式与最佳实践

## 测试分层策略

```
┌──────────────────────────────────────────┐
│  E2E Tests (端到端测试)                    │  ← 少量，覆盖关键用户流程
│  启动完整服务，模拟真实请求                  │
├──────────────────────────────────────────┤
│  Integration Tests (集成测试)              │  ← 适量，覆盖接口交互
│  测试路由+依赖注入+数据库                   │
├──────────────────────────────────────────┤
│  Unit Tests (单元测试)                     │  ← 大量，覆盖业务逻辑
│  测试独立函数/类，Mock 外部依赖              │
└──────────────────────────────────────────┘
```

**比例建议**: 单元测试 70% / 集成测试 20% / E2E 测试 10%

---

## 1. 单元测试模式

### 1.1 测试 Pydantic 模型校验

```python
import pytest
from pydantic import ValidationError
from app.schemas.user import UserCreate


def test_user_create_valid():
    """合法数据创建成功"""
    user = UserCreate(username="test", email="test@example.com", password="Str0ng!Pass")
    assert user.username == "test"


def test_user_create_invalid_email():
    """非法邮箱抛出 ValidationError"""
    with pytest.raises(ValidationError) as exc_info:
        UserCreate(username="test", email="not-an-email", password="Str0ng!Pass")
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("email",) for e in errors)


def test_user_create_short_password():
    """密码过短抛出 ValidationError"""
    with pytest.raises(ValidationError):
        UserCreate(username="test", email="test@example.com", password="123")


def test_user_create_missing_required():
    """缺失必填字段抛出 ValidationError"""
    with pytest.raises(ValidationError) as exc_info:
        UserCreate(username="test")  # 缺 email 和 password
    assert len(exc_info.value.errors()) == 2
```

### 1.2 测试业务逻辑服务

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.user_service import UserService


@pytest.fixture
def mock_repo():
    """Mock 用户仓库"""
    repo = MagicMock()
    repo.get_by_username = AsyncMock(return_value=None)
    repo.create = AsyncMock()
    return repo


@pytest.fixture
def user_service(mock_repo):
    return UserService(repository=mock_repo)


@pytest.mark.asyncio
async def test_register_new_user(user_service, mock_repo):
    """注册新用户成功"""
    mock_repo.get_by_username.return_value = None
    mock_repo.create.return_value = MagicMock(id=1, username="newuser")
    
    result = await user_service.register(username="newuser", password="pass123")
    
    mock_repo.get_by_username.assert_called_once_with("newuser")
    mock_repo.create.assert_called_once()
    assert result.username == "newuser"


@pytest.mark.asyncio
async def test_register_duplicate_user(user_service, mock_repo):
    """注册重复用户抛出异常"""
    mock_repo.get_by_username.return_value = MagicMock(username="existing")
    
    with pytest.raises(ValueError, match="already exists"):
        await user_service.register(username="existing", password="pass123")
    
    mock_repo.create.assert_not_called()
```

### 1.3 测试依赖注入函数

```python
import pytest
from fastapi import HTTPException
from app.api.deps import get_current_user


@pytest.mark.asyncio
async def test_get_current_user_valid_token(db_session):
    """有效 token 返回用户"""
    user = await get_current_user(token=valid_token, db=db_session)
    assert user is not None


@pytest.mark.asyncio
async def test_get_current_user_expired_token(db_session):
    """过期 token 抛出 401"""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=expired_token, db=db_session)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(db_session):
    """伪造 token 抛出 401"""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token="invalid.token.here", db=db_session)
    assert exc_info.value.status_code == 401
```

---

## 2. 集成测试模式

### 2.1 CRUD 端点完整测试

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_crud_lifecycle(auth_client):
    """完整 CRUD 生命周期测试"""
    
    # CREATE
    create_resp = await auth_client.post("/api/v1/items", json={
        "title": "Test Item",
        "description": "A test item",
    })
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    
    # READ (single)
    read_resp = await auth_client.get(f"/api/v1/items/{item_id}")
    assert read_resp.status_code == 200
    assert read_resp.json()["title"] == "Test Item"
    
    # UPDATE
    update_resp = await auth_client.put(f"/api/v1/items/{item_id}", json={
        "title": "Updated Item",
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated Item"
    
    # DELETE
    delete_resp = await auth_client.delete(f"/api/v1/items/{item_id}")
    assert delete_resp.status_code == 204
    
    # READ (确认已删除)
    read_again = await auth_client.get(f"/api/v1/items/{item_id}")
    assert read_again.status_code == 404
```

### 2.2 分页接口测试

```python
@pytest.mark.asyncio
async def test_pagination(auth_client, multiple_items):
    """分页参数正确返回对应页数据"""
    # 第一页
    resp = await auth_client.get("/api/v1/items?skip=0&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    
    # 第二页
    resp2 = await auth_client.get("/api/v1/items?skip=2&limit=2")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) >= 1
    assert data2[0]["id"] != data[0]["id"]  # 不同页的数据不同


@pytest.mark.asyncio
async def test_pagination_invalid_params(auth_client):
    """非法分页参数返回 422"""
    resp = await auth_client.get("/api/v1/items?skip=-1&limit=0")
    assert resp.status_code == 422
```

### 2.3 文件上传测试

```python
@pytest.mark.asyncio
async def test_upload_file(auth_client):
    """文件上传成功"""
    files = {"file": ("test.txt", b"Hello, World!", "text/plain")}
    resp = await auth_client.post("/api/v1/upload", files=files)
    assert resp.status_code == 200
    assert "url" in resp.json()


@pytest.mark.asyncio
async def test_upload_invalid_file_type(auth_client):
    """不支持文件类型返回 422"""
    files = {"file": ("test.exe", b"binary content", "application/octet-stream")}
    resp = await auth_client.post("/api/v1/upload", files=files)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_oversized_file(auth_client):
    """超大文件返回 413"""
    large_content = b"x" * (11 * 1024 * 1024)  # 11MB
    files = {"file": ("large.bin", large_content, "application/octet-stream")}
    resp = await auth_client.post("/api/v1/upload", files=files)
    assert resp.status_code == 413
```

---

## 3. 异常与边界测试模式

### 3.1 全局异常处理验证

```python
@pytest.mark.asyncio
async def test_404_not_found(auth_client):
    """访问不存在的资源返回 404"""
    resp = await auth_client.get("/api/v1/items/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_405_method_not_allowed(auth_client):
    """不支持的方法返回 405"""
    resp = await auth_client.patch("/api/v1/items")  # 如果没有 PATCH
    assert resp.status_code == 405


@pytest.mark.asyncio
async def test_422_validation_error(auth_client):
    """请求数据校验失败返回 422"""
    resp = await auth_client.post("/api/v1/items", json={"invalid": "field"})
    assert resp.status_code == 422
    error_detail = resp.json()["detail"]
    assert isinstance(error_detail, list)
```

### 3.2 边界值测试

```python
@pytest.mark.asyncio
async def test_create_item_max_length(auth_client):
    """字段达到最大长度仍成功"""
    max_title = "A" * 255  # 假设 title 最大 255 字符
    resp = await auth_client.post("/api/v1/items", json={"title": max_title})
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_item_over_max_length(auth_client):
    """字段超过最大长度返回 422"""
    over_title = "A" * 256
    resp = await auth_client.post("/api/v1/items", json={"title": over_title})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_item_empty_string(auth_client):
    """空字符串字段根据业务判断"""
    resp = await auth_client.post("/api/v1/items", json={"title": ""})
    # 如果业务不允许空标题，断言 422；如果允许，断言 201
    assert resp.status_code in (201, 422)


@pytest.mark.asyncio
async def test_create_item_unicode(auth_client):
    """Unicode 字符正常处理"""
    resp = await auth_client.post("/api/v1/items", json={"title": "中文标题 🎉"})
    assert resp.status_code == 201
```

### 3.3 SQL 注入防护验证

```python
@pytest.mark.asyncio
async def test_sql_injection_in_search(auth_client):
    """搜索参数中的 SQL 注入不应生效"""
    malicious = "'; DROP TABLE items; --"
    resp = await auth_client.get(f"/api/v1/items?search={malicious}")
    assert resp.status_code == 200  # 不应崩溃
    
    # 确认表仍存在
    list_resp = await auth_client.get("/api/v1/items")
    assert list_resp.status_code == 200
```

---

## 4. 并发与性能测试模式

### 4.1 限流测试

```python
import pytest
import asyncio


@pytest.mark.asyncio
async def test_rate_limiting(auth_client):
    """频繁请求触发限流"""
    # 快速发送多个请求
    responses = []
    for _ in range(20):  # 假设限流阈值为 10 次/分钟
        resp = await auth_client.get("/api/v1/items")
        responses.append(resp.status_code)
    
    # 至少有一个被限流
    assert 429 in responses
```

### 4.2 并发创建资源

```python
@pytest.mark.asyncio
async def test_concurrent_create(auth_client):
    """并发创建相同资源不会产生重复"""
    import asyncio
    
    tasks = [
        auth_client.post("/api/v1/items", json={"title": f"Item {i}"})
        for i in range(5)
    ]
    responses = await asyncio.gather(*tasks)
    
    status_codes = [r.status_code for r in responses]
    # 所有请求都应成功
    assert all(code in (200, 201) for code in status_codes)
```

---

## 5. 中间件测试模式

### 5.1 CORS 测试

```python
@pytest.mark.asyncio
async def test_cors_headers(async_client):
    """CORS 预检请求返回正确的头"""
    resp = await async_client.options(
        "/api/v1/items",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" in resp.headers
```

### 5.2 认证中间件

```python
@pytest.mark.asyncio
async def test_missing_auth_header(async_client):
    """缺少 Authorization 头返回 401"""
    resp = await async_client.get("/api/v1/protected")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_malformed_auth_header(async_client):
    """格式错误的 Authorization 头返回 401"""
    resp = await async_client.get(
        "/api/v1/protected",
        headers={"Authorization": "InvalidFormat token123"},
    )
    assert resp.status_code == 401
```

---

## 6. WebSocket 测试

```python
from fastapi.testclient import TestClient


def test_websocket_connection(client):
    """WebSocket 连接与消息收发"""
    with client.websocket_connect("/ws/chat") as websocket:
        websocket.send_json({"message": "Hello"})
        data = websocket.receive_json()
        assert data["message"] == "Hello"


def test_websocket_auth_failure(client):
    """WebSocket 认证失败断开连接"""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/chat?token=invalid") as websocket:
            websocket.receive_json()
```

---

## 7. 最佳实践总结

### 测试命名规范

```python
# ✅ 好的命名：描述场景和预期结果
def test_create_user_with_existing_email_returns_409():
    ...

# ❌ 差的命名：过于笼统
def test_create_user_error():
    ...
```

### 测试组织 AAA 模式

```python
@pytest.mark.asyncio
async def test_update_item_owner_cannot_modify(auth_client, other_user_item):
    # Arrange - 准备测试数据
    item_id = other_user_item.id
    
    # Act - 执行被测操作
    response = await auth_client.put(f"/api/v1/items/{item_id}", json={"title": "Hacked"})
    
    # Assert - 验证结果
    assert response.status_code == 403
```

### 避免测试间的耦合

```python
# ❌ 差：测试间共享状态
created_item_id = None

def test_create():
    global created_item_id
    resp = client.post(...)
    created_item_id = resp.json()["id"]

def test_read():
    resp = client.get(f"/items/{created_item_id}")  # 依赖上一个测试


# ✅ 好：每个测试独立设置数据
@pytest.fixture
def existing_item(auth_client):
    resp = auth_client.post("/items", json={"title": "Test"})
    return resp.json()

def test_read(existing_item):
    resp = auth_client.get(f"/items/{existing_item['id']}")
    assert resp.status_code == 200
```

### 参数化测试减少重复

```python
@pytest.mark.parametrize("field,value,expected_status", [
    ("title", "", 422),                    # 空标题
    ("title", "A" * 256, 422),             # 过长标题
    ("title", "Valid Title", 201),          # 合法标题
    ("price", -1, 422),                     # 负价格
    ("price", 0, 201),                      # 零价格（如果允许）
    ("price", 99.99, 201),                  # 合法价格
])
@pytest.mark.asyncio
async def test_create_item_field_validation(auth_client, field, value, expected_status):
    """参数化验证各字段的边界值"""
    payload = {"title": "Valid", "price": 10.0}
    payload[field] = value
    resp = await auth_client.post("/api/v1/items", json=payload)
    assert resp.status_code == expected_status
```

### 异步测试注意事项

```python
# 确保 pytest.ini / pyproject.toml 中配置了：
# [tool.pytest.ini_options]
# asyncio_mode = "auto"

# 或者在 conftest.py 中：
# pytest_plugins = ["pytest_asyncio"]

# 每个异步测试使用 @pytest.mark.asyncio 装饰器
# 异步 fixture 使用 async def + yield
```

### 依赖覆盖而非 Mock

```python
# ✅ 推荐：使用 dependency_overrides 替换整个依赖
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

# ❌ 不推荐：在路由内部 Mock 数据库调用
with patch("app.routes.items.get_db"):
    ...
```

### 测试数据清理

```python
# 方式1: 事务回滚（推荐）
@pytest.fixture
async def db_session(test_engine):
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()  # 自动回滚

# 方式2: 显式清理
@pytest.fixture
async def test_user(db_session):
    user = User(username="test")
    db_session.add(user)
    await db_session.flush()
    yield user
    await db_session.delete(user)  # 显式删除
```
