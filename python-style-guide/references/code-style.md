# 代码风格规范 (PEP 8)

---

## 缩进与空格

### 基本缩进

```python
# ✅ 4 空格缩进，禁止使用 Tab
def func():
    if condition:
        do_something()
        for item in items:
            process(item)

# ❌ Tab 缩进
def func():
	if condition:
		do_something()
```

### 行长度与换行

```python
# ✅ 运算符后换行（数学风格，Black 默认）
income = (gross_wages
          + taxable_interest
          + dividends
          - ira_deduction
          - student_loan_interest)

# ✅ 参数独立成行
def function(
    long_name_1: int,
    long_name_2: int,
    long_name_3: int,
) -> None:
    pass

# ✅ 顶级导出函数可单行（简短时）
def add(a: int, b: int) -> int: return a + b
```

---

## 导入规范

### 标准顺序

```python
# 1. 标准库
import os
import sys
import json
from typing import Any, Optional

# 2. 第三方库
import requests
import numpy as np
from django.conf import settings

# 3. 本地应用/库
from myapp.models import User
from myapp.utils import format_date, parse_config
```

### 导入规则

```python
# ✅ 推荐：明确导入
from os import path, getcwd
import os.path as path_ops

# ❌ 避免：批量导入
from os import *  # 禁止

# ❌ 避免：同行导入多个
import os, sys, json

# ❌ 避免：循环导入
# a.py 导入 b.py，b.py 又导入 a.py → 重构设计
```

---

## 命名规范

| 类型 | 命名方式 | 示例 | 备注 |
|------|----------|------|------|
| 函数/变量 | snake_case | `get_user`, `total_count` | |
| 类 | PascalCase | `UserProfile`, `HttpClient` | |
| 模块 | snake_case | `utils.py`, `http_helpers.py` | 短小优先 |
| 常量 | UPPER_CASE | `MAX_RETRY`, `API_TIMEOUT` | 模块级常量 |
| 私有属性 | `_single` | `_cache`, `_internal_state` | |
| 私有方法 | `_method` | `_validate_input` | |
| 内部类 | `__double` | `__init__` | 名称修饰 |

### 具体示例

```python
# ✅ 函数
def calculate_total():
    ...

def get_user_by_id():
    ...

# ✅ 类
class UserService:
    ...

class HttpRequestHandler:
    ...

# ✅ 常量
MAX_CONNECTIONS = 100
DEFAULT_TIMEOUT = 30

# ✅ 私有
class Cache:
    def __init__(self):
        self._data = {}
        self._ttl = 3600
    
    def _evict_expired(self):
        ...
```

---

## 空格规范

### 运算符周围

```python
# ✅ 正确
x = 1 + 2
y = x * 2 + 3
name = first + " " + last

# ❌ 错误
x = 1+2
y = x*2+3

# ✅ 函数调用无空格
func(arg1, arg2)
func(arg1, kwarg=value)

# ✅ 索引和切片无额外空格
data[0]
data[start:end]
data[::2]
```

### 括号内

```python
# ✅ 括号内无空格
func(arg1, arg2)
my_dict = {"key": "value"}

# ❌ 避免
func( arg1, arg2 )
my_dict = { "key": "value" }

# ✅ 字典推导式
lookup = {item.id: item for item in items if item.active}
```

### 其他规范

```python
# ✅ 行尾无多余空格
name = "Alice"  # 无尾部空格

# ✅ import 语句后空两行
import os
import sys


def main():
    pass

# ✅ 类定义之间空两行
class ClassA:
    pass


class ClassB:
    pass

# ✅ 方法之间空一行
class MyClass:
    def method_a(self) -> None:
        pass

    def method_b(self) -> None:
        pass
```

---

## 文件结构

```python
#!/usr/bin/env python3
"""Module docstring: 简短描述模块功能."""

from __future__ import annotations

import os
import sys
from typing import Any

# 第三方导入
import requests

# 本地导入
from myapp.models import User


class MyClass:
    """类的简短描述。"""
    
    def __init__(self, value: int) -> None:
        self._value = value
    
    def get_value(self) -> int:
        """返回存储的值。"""
        return self._value


def main() -> None:
    """程序入口点。"""
    ...


if __name__ == "__main__":
    main()
```

---

## 注释规范

```python
# ✅ 行内注释：用在代码右侧，解释不明显的地方
x = x + 1  # 补偿边界情况

# ✅ 块注释：解释复杂逻辑（少用，优先重构代码）
# 计算折扣：
# 1. 基础折扣 10%
# 2. VIP 额外 5%
# 3. 限时活动可叠加
discount = base * 0.9 * (1 + vip_bonus) * (1 + promo_rate)

# ❌ 避免：解释显而易见的事
x = x + 1  # 加一

# ❌ 避免：被代码替代的注释
# 使用 for 循环遍历列表
for item in items:
    process(item)
```

---

## 相关资源

- [PEP 8 官方文档](https://pep8.org/)
- [Black 代码格式化器](https://black.readthedocs.io/)
- [Ruff Linter](https://beta.ruff.rs/)
