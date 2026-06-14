# 反模式

> 应避免的错误写法及其正确替代方案。

---

## 可变默认参数

### 问题

```python
# ❌ 错误 - 默认参数在函数定义时创建，共享于所有调用
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

# 演示问题
result1 = add_item("apple")
result2 = add_item("banana")
print(result1)  # ['apple', 'banana'] - 预期只有 'apple'
print(result2)  # ['apple', 'banana'] - 两者相同！
```

### 正确做法

```python
# ✅ None + 内部赋值
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items

# ✅ 或使用不可变类型
def add_item(item: str, *extra_items: str) -> list[str]:
    return [item, *extra_items]
```

---

## 裸 except

### 问题

```python
# ❌ 捕获所有异常，包括 SystemExit 和 KeyboardInterrupt
try:
    do_something()
except:  # 危险！
    pass

# 这会隐藏真正的错误
try:
    config = load_config()
except:  # 如果文件不存在，隐藏了具体错误
    config = {}
```

### 正确做法

```python
# ✅ 只捕获预期异常
try:
    value = int(user_input)
except ValueError:
    value = 0

# ✅ 捕获多个相关异常
try:
    data = cache.get(key)
except (KeyError, AttributeError):
    data = compute_default()

# ✅ 捕获并重新抛出
try:
    result = risky_operation()
except SpecificError as e:
    logger.error(f"Failed: {e}")
    raise  # 重新抛出，让调用者处理

# ✅ 异常链
try:
    db.query(sql)
except db.Error as e:
    raise RuntimeError("Database error") from e  # 保留原始异常
```

---

## None 比较

### 问题

```python
# ❌ 使用 == 比较 None
if value == None:
    ...

if value != None:
    ...

# ⚠️ 如果 __eq__ 被重载，可能产生意外结果
```

### 正确做法

```python
# ✅ 使用 is / is not
if value is None:
    ...

if value is not None:
    ...

# ✅ 常见模式
name = user.name or "Anonymous"  # None 或空字符串都处理
items = data or []              # None 转空列表

# ✅ 显式检查
if value is not None and value > 0:
    ...
```

---

## 空值判断

### 问题

```python
# ❌ 使用 len() 判断空
if len(items) == 0:
    ...
if len(items) > 0:
    ...

# ❌ 显式比较
if items == []:
    ...
```

### 正确做法

```python
# ✅ 使用 truthiness
if not items:  # 空列表、None 都为 False
    ...

if items:  # 非空
    ...

# ✅ 需要长度时
item_count = len(items)
if item_count > 0:
    ...

# ✅ 显式布尔（当布尔含义重要时）
if len(items) == 0:  # 可接受，当意图需要明确时
    return "No items"
```

---

## 字符串拼接

### 问题

```python
# ❌ 循环内拼接
result = ""
for item in items:
    result += str(item)  # 每步创建新字符串，O(n²)

# ❌ 多行字符串
query = "SELECT * FROM users "
query += "WHERE active = true "
query += "ORDER BY name"
```

### 正确做法

```python
# ✅ join() 方法
result = "".join(str(item) for item in items)
result = ", ".join(str(item) for item in items)

# ✅ join 处理多行
query = " ".join([
    "SELECT * FROM users",
    "WHERE active = true",
    "ORDER BY name",
])

# ✅ f-string（简短时）
name = f"{first_name} {last_name}"

# ✅ 列表推导式 + join
words = [w.capitalize() for w in text.split()]
formatted = " ".join(words)
```

---

## 深度嵌套

### 问题

```python
# ❌ 过度嵌套，难以阅读
def process(data):
    if data:
        if data.get("config"):
            if data["config"].get("settings"):
                for item in data["config"]["settings"]:
                    if item.get("enabled"):
                        do_something(item)
```

### 正确做法

```python
# ✅ 提前返回（Guard Clauses）
def process(data):
    if not data:
        return
    
    config = data.get("config")
    if not config:
        return
    
    settings = config.get("settings")
    if not settings:
        return
    
    for item in settings:
        if item.get("enabled"):
            do_something(item)

# ✅ 提取为辅助函数
def is_valid_item(item):
    return item and item.get("enabled")

def process_enabled_items(data):
    settings = data.get("config", {}).get("settings", [])
    enabled = filter(is_valid_item, settings)
    for item in enabled:
        do_something(item)
```

---

## 重复计算

### 问题

```python
# ❌ 重复计算
if len(items) > 0 and len(items) < 100:
    ...
```

### 正确做法

```python
# ✅ 缓存计算结果
n = len(items)
if 0 < n < 100:
    ...

# ✅ 缓存昂贵操作
expensive_result = compute_expensive_value()
if expensive_result is not None:
    use(expensive_result)
    # ... 更多使用处
```

---

## 全局状态

### 问题

```python
# ❌ 隐式全局状态
_counter = 0

def increment():
    global _counter
    _counter += 1
    return _counter

# ⚠️ 难以测试，多线程不安全
```

### 正确做法

```python
# ✅ 类封装
class Counter:
    def __init__(self):
        self._count = 0
    
    def increment(self) -> int:
        self._count += 1
        return self._count
    
    @property
    def count(self) -> int:
        return self._count

# ✅ 依赖注入
def process(items: list[str], counter: Counter) -> None:
    for item in items:
        if validate(item):
            counter.increment()
```

---

## 类型滥用

### 问题

```python
# ❌ 滥用 Any
def process(data: Any) -> Any:
    return data

# ❌ 字典里全用 Any
def get_user() -> dict[str, Any]:
    return {"id": 1, "name": "Alice"}  # 失去类型安全

# ❌ 类型注解缺失
def parse(data):
    ...
```

### 正确做法

```python
# ✅ 明确类型
def parse(data: str) -> dict[str, int | str]:
    ...

# ✅ TypedDict 定义结构
class UserResponse(TypedDict):
    id: int
    name: str
    email: str | None

def get_user() -> UserResponse:
    return {"id": 1, "name": "Alice", "email": None}

# ✅ TypeGuard 收窄
def is_valid_config(data: object) -> TypeGuard[dict[str, str]]:
    return isinstance(data, dict) and all(
        isinstance(k, str) and isinstance(v, str) 
        for k, v in data.items()
    )
```

---

## 硬编码魔法值

### 问题

```python
# ❌ 魔法数字
if status == 1:
    ...

for i in range(1000):
    ...

# ❌ 魔法字符串
if env == "production":
    ...
```

### 正确做法

```python
# ✅ 命名常量
from enum import IntEnum

class OrderStatus(IntEnum):
    PENDING = 1
    PROCESSING = 2
    COMPLETED = 3
    CANCELLED = 4

if status == OrderStatus.PENDING:
    ...

# ✅ 配置常量
MAX_BATCH_SIZE = 1000
API_TIMEOUT = 30

# ✅ 环境变量
import os
ENV = os.environ.get("ENV", "development")
IS_PROD = ENV == "production"
```

---

## import * 

### 问题

```python
# ❌ wildcard 导入
from os import *

# 这会污染命名空间：
# os 模块有 read, write 等函数
# 如果你的代码也定义了这些，会被覆盖
```

### 正确做法

```python
# ✅ 模块导入
import os
from os import path, getcwd

# ✅ 显式指定
from mymodule import (
    public_func1,
    public_func2,
    PublicClass,
)

# ✅ __all__ 控制导出
# mymodule.py
__all__ = ["public_func", "PublicClass"]
_internal_func = lambda: ...  # 不会 from mymodule import *
```

---

## 忽视异常

### 问题

```python
# ❌ pass 隐藏异常
try:
    risky_operation()
except Exception:
    pass  # 静默忽略，隐藏 bug

# ❌ except Exception + pass
try:
    do_something()
except Exception:
    pass  # 太宽泛
```

### 正确做法

```python
# ✅ 记录并重新抛出
try:
    risky_operation()
except SpecificError as e:
    logger.warning(f"Expected error: {e}")
    raise

# ✅ 使用 logging
import logging
logger = logging.getLogger(__name__)

try:
    do_something()
except ValueError as e:
    logger.debug(f"Validation skipped: {e}")

# ✅ 业务逻辑处理
try:
    send_notification(user)
except NotificationError as e:
    logger.error(f"Failed to notify {user.id}: {e}")
    # 继续执行，不阻塞主流程
```
