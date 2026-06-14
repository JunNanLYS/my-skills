---
name: python-style-guide
description: >
  Python 开发规范与最佳实践指南。当涉及以下场景时必须使用本技能：
  编写、审查、重构 Python 代码，代码风格、PEP 8、lint、格式化检查，
  Python 类型注解（type hints/typing）、Pydantic、dataclass，
  Python 单元测试（pytest/unittest）、代码审查（code review），
  Python 依赖管理（uv/pip）、虚拟环境配置，
  Pythonic 模式、反模式检测、安全编码。
  触发词：Python、PEP 8、py_compile、pytest、ruff、black、mypy、
  type hints、typing、dataclass、TypedDict、Protocol、TypeVar、
  uv、pip、venv、virtualenv、__init__、__main__、def、class
version: 1.0.0
---

# Python 开发规范

> **渐进式披露**：本技能按需求深度分层展开。SKILL.md 是入口目录，详细信息在 `references/` 目录按需读取。

---

## 📊 层级导航

| 层级 | 内容 | 适合场景 |
|------|------|----------|
| **快速开始** | [代码风格](#代码风格-pep-8) + [反模式](#反模式) | 日常编码参考 |
| [Level 1-2](#references) | 基础类型、容器、Union/Optional | 函数类型标注 |
| [Level 3-4](#references) | TypedDict/NamedTuple/dataclass、泛型 | 数据结构建模 |
| [Level 5](#references) | 运行时守卫、TypeGuard、Literal | 高级类型控制 |
| [执行准则](#references) | 类型注解强制规范 | 严格规范遵循 |
| [速查表](#references) | 常用符号速查 | 快速对照 |

---

## 🚀 快速开始

你是 Python 开发规范助手。遇到问题时：

1. **代码风格** → 查看 [references/code-style.md](references/code-style.md)
2. **提交前检查** → 查看 [references/pre-commit.md](references/pre-commit.md)
3. **Pythonic 写法** → 查看 [references/pythonic-patterns.md](references/pythonic-patterns.md)
4. **应避免的错误** → 查看 [references/anti-patterns.md](references/anti-patterns.md)
5. **类型注解** → 根据深度选择对应 level

---

## 代码风格 (PEP 8)

### 核心规则速览

```python
# ✅ 缩进：4 空格，禁止 Tab
# ✅ 行长度：最多 88 字符（Black）或 79 字符（严格 PEP 8）
# ✅ 导入顺序：stdlib → third-party → local
# ✅ 命名：snake_case 函数/变量，PascalCase 类，UPPER_CASE 常量

# ✅ 正确示例
def calculate_total(items: list[float], tax_rate: float) -> float:
    """Calculate total with tax."""
    subtotal = sum(items)
    return subtotal * (1 + tax_rate)

# ❌ 避免
def calculateTotal(items, TaxRate):  # camelCase
    subtotal = sum(items)              # 缺少类型提示
    return subtotal * (1 + TaxRate)
```

### 导入规范

```python
# ✅ 标准库 → 第三方 → 本地，按字母排序
import os
import sys
from typing import Any

import requests
from django.conf import settings

from myapp.models import User
from myapp.utils import helper

# ❌ 避免
import sys, os  # 不要同行导入
from myapp import models, utils  # 不要批量导入
from myapp.models import *       # 禁止 wildcard 导入
```

---

## 反模式

### 必须避免的错误

```python
# ❌ 可变默认参数
def bad(items=[]):
    items.append(1)
    return items

# ✅ 正确
def good(items=None):
    items = items or []
    items.append(1)
    return items

# ❌ 裸 except
try:
    do_something()
except:  # 捕获所有异常（包括 SystemExit）
    pass

# ✅ 正确
try:
    do_something()
except ValueError as e:
    handle_error(e)

# ❌ == None 判断
if value == None:
    ...

# ✅ 正确
if value is None:
    ...

# ❌ len() 判断空
if len(items) == 0:
    ...

# ✅ 正确
if not items:
    ...
```

---

## 类型注解快速参考

```python
# ✅ 基础函数
def greet(name: str, age: int) -> str:
    return f"Hello {name}"

# ✅ 容器类型（3.9+）
def process(items: list[int]) -> dict[str, int]:
    ...

# ✅ 可选值（3.10+）
def find_user(user_id: int) -> User | None:
    ...

# ✅ 数据类
from dataclasses import dataclass

@dataclass
class User:
    name: str
    email: str
    active: bool = True
```

### 典型问答模式

- 「函数参数怎么标类型？」 → [Level 1](references/type-annotations.md#level-1--基础标注)
- 「列表里装什么类型怎么写？」 → [Level 2](references/type-annotations.md#level-2--容器与组合)
- 「字典结构怎么定义字段？」 → [Level 3](references/type-annotations.md#level-3--结构化类型)
- 「泛型函数怎么写？」 → [Level 4](references/type-annotations.md#level-4--泛型与抽象)
- 「怎么限制参数只能是某些值？」 → [Level 5](references/type-annotations.md#level-5--运行时守卫)
- 「类型注解有哪些强制规则？」 → [执行准则](references/type-annotations.md#执行准则)
- 「所有 typing 符号在哪查？」 → [速查表](references/quick-ref.md)

---

## 快速检查清单

- [ ] **语法检查**: `python -m py_compile *.py`
- [ ] **测试通过**: `python -m pytest -v`
- [ ] **代码格式化**: `ruff check . --fix` 或 `black .`
- [ ] **类型提示**: 公共函数有类型注解
- [ ] **无硬编码密钥**: 检查无明文密码/API Key
- [ ] **f-string**: 使用 `f"{}"` 而非 `.format()` 或 `%`
- [ ] **pathlib**: 使用 `Path` 处理文件路径
- [ ] **上下文管理器**: 使用 `with` 管理资源
- [ ] **可变默认参数**: 避免 `def f(items=[])`

---

## 📚 完整参考

| 文档 | 内容 |
|------|------|
| [code-style.md](references/code-style.md) | 完整代码风格规范 |
| [pre-commit.md](references/pre-commit.md) | 提交前检查脚本 |
| [version-deps.md](references/version-deps.md) | Python 版本 & 依赖管理 |
| [pythonic-patterns.md](references/pythonic-patterns.md) | 惯用 Pythonic 模式 |
| [anti-patterns.md](references/anti-patterns.md) | 反模式详解 |
| [type-annotations.md](references/type-annotations.md) | 类型注解完整指南 |
| [testing.md](references/testing.md) | 测试规范 |
| [docstrings.md](references/docstrings.md) | 文档字符串规范 |
| [security.md](references/security.md) | 安全编码规范 |
| [quick-ref.md](references/quick-ref.md) | 速查表 |
