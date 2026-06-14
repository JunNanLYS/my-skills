# 测试规范

---

## 测试框架选择

| 框架 | 适用场景 | 特点 |
|------|----------|------|
| **pytest** | 通用测试（推荐） | 简洁、强大、插件丰富 |
| **unittest** | 单元测试 | 标准库，无需安装 |
| **pytest-django** | Django 项目 | Django 集成 |
| **pytest-asyncio** | 异步代码 | asyncio 支持 |

---

## pytest 基础

### 测试文件命名

```python
# ✅ 正确
tests/
├── test_user.py           # 模块名
├── test_order_service.py # 功能名
├── api/
│   ├── __init__.py
│   ├── test_auth.py      # 子模块
│   └── test_users.py

# ❌ 避免
TestUser.py      # 大写
user_test.py     # test_ 在后
```

### 测试函数命名

```python
# ✅ 描述性名称
def test_user_creation_with_valid_data():
    ...

def test_user_creation_with_duplicate_email_raises_error():
    ...

def test_calculate_total_with_empty_cart_returns_zero():
    ...

# ❌ 模糊名称
def test_create():
    ...

def test_calc():
    ...
```

### 基础断言

```python
import pytest

def test_basic_assertions():
    # 相等
    assert result == expected
    assert result is expected  # 同一对象
    
    # 布尔
    assert is_valid
    assert not is_disabled
    
    # 异常
    with pytest.raises(ValueError, match="invalid.*"):
        parse_data("invalid")
    
    # 近似相等
    assert abs(result - expected) < 0.001
    
    # 包含
    assert "error" in log_output
    assert item in collection
```

---

## Fixture

### 基础 Fixture

```python
import pytest
from myapp.models import User, Database

@pytest.fixture
def db():
    """测试数据库。"""
    db = Database(":memory:")
    db.connect()
    yield db
    db.close()

@pytest.fixture
def sample_user(db):
    """创建示例用户。"""
    return db.create_user(name="Alice", email="alice@example.com")

# 使用
def test_user_name(db, sample_user):
    assert sample_user.name == "Alice"
```

### Fixture 作用域

```python
@pytest.fixture(scope="module")  # 模块级别，所有测试共享
def config():
    ...

@pytest.fixture(scope="session")  # 会话级别，整个测试运行只执行一次
def app():
    ...

@pytest.fixture  # 默认：function，每个测试新建
def temp_file():
    ...
```

### Fixture 依赖

```python
@pytest.fixture
def db():
    return Database(":memory:")

@pytest.fixture
def user(db):  # 依赖 db fixture
    return db.create_user(name="Test")

def test_user(user):  # 同时获得 db 和 user
    assert user.name == "Test"
```

### 参数化 Fixture

```python
@pytest.fixture(params=["sqlite", "postgres", "mysql"])
def db_connection(request):
    db = Database(request.param)
    yield db
    db.close()

def test_query(db_connection):
    assert db_connection.execute("SELECT 1") == [(1,)]
```

---

## Mock 与 Patch

### unittest.mock 基础

```python
from unittest.mock import Mock, patch, MagicMock
import pytest

def test_fetch_user():
    with patch("myapp.services.user.requests.get") as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = {"id": 1, "name": "Alice"}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response
        
        user = fetch_user(user_id=1)
        
        assert user.name == "Alice"
        mock_get.assert_called_once_with("https://api.example.com/users/1")
```

### Mock 对象

```python
def test_process_with_mock():
    # 创建模拟对象
    mock_cache = MagicMock()
    mock_cache.get.return_value = {"cached": "data"}
    mock_cache.set.return_value = None
    
    # 使用
    result = process_with_cache(mock_cache, "key")
    assert result == {"cached": "data"}
    
    # 验证调用
    mock_cache.get.assert_called_once_with("key")
    mock_cache.set.assert_not_called()  # 缓存命中时不应设置
```

### 常见 patch 路径

```python
# patch 目标必须是可导入的对象
# ✅ 正确的 patch 路径
@patch("myapp.services.UserService.get_user")
def test_get_user(mock_get):
    ...

# ❌ 错误：patch 了 import 语句
from myapp.services import UserService
@patch("UserService.get_user")  # 错误
def test_get_user(mock_get):
    ...
```

### Spy（监视真实对象）

```python
from unittest.mock import call

def test_logger_spy():
    real_logger = Logger()
    
    # spy：包装真实对象，记录所有调用
    spy_logger = MagicMock(wraps=real_logger)
    
    log_message(spy_logger, "test message")
    
    # 验证调用了真实方法
    spy_logger.info.assert_called_once_with("test message")
    assert len(spy_logger.mock_calls) > 0
```

---

## 测试组织

### 测试类

```python
class TestUserService:
    """UserService 测试套件。"""
    
    @pytest.fixture
    def service(self, db):
        return UserService(db)
    
    @pytest.fixture
    def sample_user(self, db):
        return db.create_user(name="Alice", email="alice@example.com")
    
    def test_create_user(self, service):
        user = service.create_user(name="Bob", email="bob@example.com")
        assert user.name == "Bob"
        assert user.email == "bob@example.com"
    
    def test_create_duplicate_email_raises(self, service, sample_user):
        with pytest.raises(DuplicateEmailError):
            service.create_user(name="Alice2", email=sample_user.email)
```

### 分组与标记

```python
import pytest

@pytest.mark.slow
def test_full_integration():
    ...

@pytest.mark.integration
def test_api_endpoint():
    ...

@pytest.mark.unit
def test_calculate():
    ...

# 运行特定标记
pytest -v -m "not slow"
pytest -v -m "unit"
```

---

## 覆盖率

### 基本使用

```bash
# 安装 pytest-cov
pip install pytest-cov

# 运行覆盖率
pytest --cov=src --cov-report=term-missing

# HTML 报告
pytest --cov=src --cov-report=html
```

### 配置

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]

[tool.coverage.run]
source = ["src"]
omit = ["tests/*", "*/__init__.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
]
```

---

## 运行测试

### 命令行

```bash
# 运行所有测试
pytest -v

# 运行指定文件
pytest tests/test_user.py -v

# 运行指定测试
pytest tests/test_user.py::test_create_user -v

# 运行匹配名称
pytest -k "test_user" -v

# 停在第一个失败
pytest -x

# 显示局部变量
pytest -l

# 对比输出
pytest --lf  # 上次失败的测试
```

### 配置 pytest.ini

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

---

## 集成测试

### 数据库测试

```python
import pytest
from sqlalchemy import create_engine

@pytest.fixture(scope="function")
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    with engine.connect() as conn:
        yield conn
    
    Base.metadata.drop_all(engine)

def test_create_user(test_db):
    result = test_db.execute(
        users.insert().values(name="Test")
    )
    test_db.commit()
    
    query = users.select().where(users.c.id == result.inserted_primary_key[0])
    row = test_db.execute(query).fetchone()
    
    assert row.name == "Test"
```

### API 测试

```python
import pytest
from fastapi.testclient import TestClient
from myapp import app

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_user(client):
    response = client.post("/users", json={
        "name": "Alice",
        "email": "alice@example.com"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
```

---

## 最佳实践

### ✅ 推荐做法

```python
# 1. 每个测试独立
def test_create_user():
    db = setup_fresh_db()  # 每次新建数据库
    service = UserService(db)
    user = service.create(name="Test")
    assert user.id is not None

# 2. 测试行为，不测试实现
def test_order_total():
    order = Order(items=[Item(price=10), Item(price=20)])
    assert order.total == 30  # 测试公开行为

# 3. 清晰的失败消息
def test_user_email_format():
    with pytest.raises(ValidationError) as exc_info:
        create_user(email="invalid")
    assert "valid email" in str(exc_info.value)

# 4. 使用常量而非魔法值
EXPECTED_TOTAL = 30.0
assert order.total == EXPECTED_TOTAL
```

### ❌ 避免做法

```python
# ❌ 过度 mocking
def test_process():
    mock_db = Mock()
    mock_cache = Mock()
    mock_logger = Mock()
    # 测试失去了真实行为

# ❌ 测试无关细节
def test_user_creation():
    user = create_user(name="Alice")
    assert user._internal_id == 1  # 测试内部实现

# ❌ 断言过多
def test_everything():
    # 拆分为多个小测试
    assert user.name
    assert user.email
    assert user.created_at
    assert user.is_active
    # ...太多测试点
```

---

## 相关资源

- [pytest 文档](https://docs.pytest.org/)
- [pytest-cov](https://pytest-cov.readthedocs.io/)
- [unittest.mock](https://docs.python.org/3/library/unittest.mock.html)
