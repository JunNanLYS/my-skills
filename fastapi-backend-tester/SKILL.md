---
name: fastapi-backend-tester
description: FastAPI 后端测试技能。在以下场景触发使用：用户需要为 FastAPI 项目编写测试、用户提到"测试后端"、"API 测试"、"接口测试"、"单元测试"、"集成测试"、"pytest"、"testclient"、"测试覆盖率"、"后端 BUG"、"接口验证"；用户要求对 FastAPI 路由/端点进行测试；用户希望生成测试用例或测试脚本来减少后端代码的缺陷率。
---

# FastAPI Backend Tester

## Overview

为 Python FastAPI 后端项目提供系统性测试方案，涵盖单元测试、集成测试、端到端测试三个层次，通过自动生成测试代码、分析路由结构、验证接口契约来减少后端 BUG 的出现概率。此技能提供完整的测试工作流，从分析项目结构到生成测试代码再到执行与覆盖率检查。

## 工作流决策树

```
用户请求测试 FastAPI 后端
│
├─ 1. 项目尚无测试 → 执行「从零搭建测试体系」流程
│
├─ 2. 项目已有测试但需要补充 → 执行「补充测试用例」流程
│
├─ 3. 需要检查测试覆盖率 → 执行「覆盖率分析与改进」流程
│
└─ 4. 遇到特定 BUG 需要回归测试 → 执行「回归测试」流程
```

## 流程一：从零搭建测试体系

### 步骤 1：分析项目结构

1. 定位 FastAPI 应用入口文件（通常为 `main.py`、`app.py` 或类似文件）
2. 识别 `app = FastAPI(...)` 实例
3. 扫描所有路由注册方式：
   - 直接在主文件中用 `@app.get/post/put/delete` 定义的路由
   - 通过 `app.include_router()` 引入的子路由模块
   - 使用 `APIRouter` 的模块文件
4. 识别中间件、依赖注入（`Depends`）、数据库会话等关键组件
5. 识别数据模型：Pydantic Model、SQLAlchemy Model、Tortoise ORM Model 等

### 步骤 2：建立测试基础设施

1. 在项目根目录创建 `tests/` 目录，结构如下：

```
tests/
├── __init__.py
├── conftest.py          # 共享 fixtures
├── test_api/            # API 端点测试
│   ├── __init__.py
│   ├── test_auth.py     # 认证相关
│   ├── test_users.py    # 用户相关
│   └── ...
├── test_services/       # 业务逻辑测试
│   ├── __init__.py
│   └── ...
├── test_models/         # 数据模型测试
│   ├── __init__.py
│   └── ...
└── test_utils/          # 工具函数测试
    ├── __init__.py
    └── ...
```

2. 生成 `conftest.py`，包含核心 fixtures（参考 `references/conftest_templates.md`）
3. 在 `pyproject.toml` 或 `pytest.ini` 中配置 pytest
4. 安装测试依赖：`pytest`、`pytest-asyncio`、`httpx`、`pytest-cov`

### 步骤 3：逐模块生成测试

按以下优先级生成测试：

| 优先级 | 测试目标 | 测试类型 | 说明 |
|--------|---------|---------|------|
| P0 | 认证/授权接口 | 集成测试 | 安全是底线 |
| P0 | 核心业务 CRUD 端点 | 集成测试 | 核心功能必须可靠 |
| P1 | 数据校验（Pydantic Model） | 单元测试 | 防止脏数据入库 |
| P1 | 依赖注入函数 | 单元测试 | 确保注入逻辑正确 |
| P2 | 边界条件与异常处理 | 单元测试 | 防止意外崩溃 |
| P2 | 中间件行为 | 集成测试 | 确保 CORS、限流等正常 |
| P3 | 工具函数/辅助方法 | 单元测试 | 低优先级但应覆盖 |

### 步骤 4：执行与验证

1. 运行 `pytest --tb=short -v` 确认所有测试通过
2. 运行 `pytest --cov=app --cov-report=term-missing` 检查覆盖率
3. 将覆盖率不足 80% 的模块标记为需补充测试

## 流程二：补充测试用例

### 步骤 1：分析现有测试覆盖情况

1. 读取 `tests/` 目录下所有测试文件
2. 运行 `pytest --collect-only` 获取已注册测试列表
3. 对比路由/端点清单，识别未覆盖的接口
4. 运行覆盖率报告，定位 `COVERAGE_MISSING` 行

### 步骤 2：按缺口补充测试

针对每个未覆盖的端点，生成以下维度的测试：

- **正常路径（Happy Path）**：合法参数 + 正确响应
- **参数校验**：缺失必填字段、类型错误、值越界
- **认证授权**：未登录、token 过期、权限不足
- **边界条件**：空列表、最大长度字符串、零值/负值
- **异常处理**：数据库连接失败、外部服务不可用

### 步骤 3：重新验证

运行完整测试套件，确认新增测试通过且无回归。

## 流程三：覆盖率分析与改进

1. 运行 `pytest --cov=<package> --cov-report=html --cov-report=term-missing`
2. 解析 `term-missing` 输出，提取未覆盖文件和行号
3. 按模块分类，按影响面排序（核心业务 > 辅助工具）
4. 为每个缺口生成针对性测试用例
5. 设定覆盖率阈值：核心业务 ≥ 90%，辅助模块 ≥ 70%

## 流程四：回归测试

当修复 BUG 后：

1. 首先编写一个能复现 BUG 的失败测试（Red）
2. 确认该测试确实失败（验证复现条件正确）
3. 修复代码使测试通过（Green）
4. 运行完整测试套件确认无回归
5. 将该测试保留为回归测试，防止同一 BUG 再现

## 核心测试模式

### API 端点测试模板

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_get_items_success(auth_client):
    """GET /items - 正常返回列表"""
    response = await auth_client.get("/api/v1/items")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_get_items_unauthorized(async_client):
    """GET /items - 未认证返回 401"""
    response = await async_client.get("/api/v1/items")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_create_item_validation_error(auth_client):
    """POST /items - 缺失必填字段返回 422"""
    response = await auth_client.post("/api/v1/items", json={})
    assert response.status_code == 422
```

### 数据库隔离测试

使用事务回滚确保测试间无数据污染：

```python
@pytest.fixture
async def db_session():
    """每个测试使用独立事务，测试结束自动回滚"""
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()
```

### Mock 外部服务

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_send_notification_failure(auth_client):
    """外部通知服务失败时返回 503"""
    with patch("app.services.notification.send_email", new_callable=AsyncMock) as mock_send:
        mock_send.side_effect = ConnectionError("SMTP unavailable")
        response = await auth_client.post("/api/v1/notify", json={"message": "test"})
        assert response.status_code == 503
```

## 测试执行命令速查

| 场景 | 命令 |
|------|------|
| 运行全部测试 | `pytest -v` |
| 运行指定模块 | `pytest tests/test_api/test_users.py -v` |
| 运行匹配关键字的测试 | `pytest -k "test_create" -v` |
| 带覆盖率 | `pytest --cov=app --cov-report=term-missing` |
| 仅运行失败用例 | `pytest --lf` |
| 并行执行（需 pytest-xdist） | `pytest -n auto` |
| 生成 HTML 覆盖率报告 | `pytest --cov=app --cov-report=html` |
| 异步测试 | 确保安装 `pytest-asyncio`，使用 `@pytest.mark.asyncio` |

## 常见问题处理

### 异步测试报错 `coroutine was never awaited`

确保：
1. 安装了 `pytest-asyncio`
2. 测试函数标记了 `@pytest.mark.asyncio`
3. `conftest.py` 中异步 fixture 使用 `async def` + `yield`

### 数据库测试数据残留

在 `conftest.py` 中使用事务回滚 fixture，或在每次测试后调用清理函数。参考 `references/conftest_templates.md` 中的 `db_session` fixture。

### `TestClient` vs `httpx.AsyncClient`

| 维度 | `TestClient`（同步） | `httpx.AsyncClient`（异步） |
|------|---------------------|--------------------------|
| 适用 | 简单同步测试 | 异步端点测试 |
| 安装 | `fastapi[all]` 自带 | 需额外安装 `httpx` |
| 性能 | 较慢（阻塞 IO） | 更快（非阻塞） |
| 推荐 | 快速验证 | 生产级测试首选 |

## Resources

### scripts/

- `generate_tests.py` — 分析 FastAPI 项目路由结构，自动生成测试骨架代码
- `run_coverage.py` — 运行覆盖率检查并输出未覆盖模块报告

### references/

- `conftest_templates.md` — 常用 conftest.py fixture 模板（数据库、认证客户端、Mock 等）
- `testing_patterns.md` — FastAPI 测试模式与最佳实践详解
