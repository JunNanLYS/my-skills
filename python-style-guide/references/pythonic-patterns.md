# Pythonic 模式

> 惯用 Python 写法，让代码更简洁、更符合语言特性。

---

## 推导式

### 列表推导式

```python
# ✅ 列表推导式
squares = [x**2 for x in range(10)]
evens = [x for x in range(20) if x % 2 == 0]

# ✅ 字典推导式
word_lengths = {word: len(word) for word in words}
lookup = {item.id: item for item in items}

# ✅ 集合推导式
unique_ids = {user.id for user in users}

# ✅ 条件表达式
labels = ["adult" if age >= 18 else "minor" for age in ages]

# ❌ 避免
squares = []
for x in range(10):
    squares.append(x**2)
```

### 嵌套推导式（谨慎使用）

```python
# ✅ 简单嵌套
matrix = [[i * j for j in range(3)] for i in range(3)]

# ❌ 过度嵌套 - 难以阅读
result = [[func(x) for x in row if condition(x)] for row in matrix if condition2(row)]

# ✅ 分解为多步
filtered = [row for row in matrix if condition2(row)]
result = [[func(x) for x in row if condition(x)] for row in filtered]
```

---

## 上下文管理器

### 文件操作

```python
# ✅ with 语句
with open("config.json", "r") as f:
    data = json.load(f)

# ✅ 多文件
with open("input.txt") as inf, open("output.txt", "w") as outf:
    outf.write(inf.read())

# ❌ 避免
f = open("file.txt")
data = f.read()
f.close()  # 忘记关闭或异常时未关闭
```

### 自定义上下文管理器

```python
from contextlib import contextmanager

@contextmanager
def timer():
    import time
    start = time.time()
    yield
    elapsed = time.time() - start
    print(f"Elapsed: {elapsed:.2f}s")

@contextmanager
def managed_resource(name: str):
    print(f"Acquiring {name}")
    resource = acquire(name)
    try:
        yield resource
    finally:
        release(name)

# 使用
with timer():
    process_data()

with managed_resource("db") as db:
    db.query("SELECT * FROM users")
```

### @asynccontextmanager

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def http_session():
    async with httpx.AsyncClient() as client:
        yield client
```

---

## 解包赋值

### 基本解包

```python
# ✅ 基础解包
first, second, third = items

# ✅ 剩余元素
first, *middle, last = items

# ✅ 交换
a, b = b, a

# ✅ 函数返回解包
x, y, z = get_coordinates()

# ✅ 嵌套解包
(a, (b, c)), d = ((1, (2, 3)), 4)
```

### 扩展解包

```python
# ✅ enumerate
for i, item in enumerate(items, start=1):
    print(f"{i}. {item}")

# ✅ zip
for name, age in zip(names, ages):
    print(f"{name}: {age}")

# ✅ zip_longest
from itertools import zip_longest
for a, b in zip_longest(list1, list2, fillvalue=0):
    ...

# ✅ 忽略不需要的值
first, _, last = get_coordinates()  # 忽略第二个值
```

---

## EAFP vs LBYL

### EAFP (Easier to Ask Forgiveness than Permission)

```python
# ✅ EAFP 风格
try:
    value = data["key"]
except KeyError:
    value = default_value

try:
    item = items[index]
except IndexError:
    item = None

# ✅ 属性访问
try:
    length = obj.length
except AttributeError:
    length = 0
```

### LBYL (Look Before You Leap)

```python
# 适用于：检查操作前提条件（非成员关系）
# ✅ 异步检查文件可写
import os
if os.access(filepath, os.W_OK):
    write_file(filepath)

# ✅ 线程安全检查
import threading
if isinstance(lock, threading.Lock):
    with lock:
        ...
```

---

## 字符串格式化

### f-string（首选，Python 3.6+）

```python
# ✅ 基础用法
name = "Alice"
msg = f"Hello {name}"

# ✅ 表达式
total = f"Total: {sum(items):.2f}"

# ✅ 调试格式
data = f"{value=}"  # Python 3.8+

# ✅ 格式化
pi = f"Pi: {math.pi:.2f}"
price = f"${amount:,.2f}"
percentage = f"{value:.1%}"

# ❌ 避免
msg = "Hello %s" % name
msg = "Hello {}".format(name)
```

### 格式化方法

```python
# ✅ 多参数
"{name} is {age} years old".format(name="Alice", age=30)

# ✅ 索引
"{0} {1} {0}".format("Hello", "World")

# ✅ 对齐
"{:<10}".format("left")    # 左对齐
"{:>10}".format("right")   # 右对齐
"{:^10}".format("center")  # 居中
```

---

## 迭代与生成

### itertools

```python
from itertools import chain, groupby, islice, count

# ✅ 链式迭代
all_items = list(chain(list1, list2, list3))

# ✅ 分组
groups = {k: list(v) for k, v in groupby(items, key=lambda x: x.category)}

# ✅ 切片迭代
batch = list(islice(items, 0, 100))

# ✅ 无限计数
for i in islice(count(), 10):  # 0-9
    print(i)
```

### 生成器

```python
# ✅ 生成器函数
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# ✅ 生成器表达式
squares_gen = (x**2 for x in range(10))
pairs = ((x, y) for x in range(3) for y in range(3))

# ✅ yield from
def flatten(nested):
    for item in nested:
        if isinstance(item, (list, tuple)):
            yield from flatten(item)
        else:
            yield item
```

---

## 数据类

### dataclass 基础

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    name: str
    email: str
    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    tags: list[str] = field(default_factory=list)

# 使用
user = User(name="Alice", email="alice@example.com")
```

### dataclass 进阶

```python
from dataclasses import dataclass, field

@dataclass(order=True, frozen=True)
class Point:
    # frozen=True 使实例不可变
    x: float
    y: float

@dataclass(slots=True)  # Python 3.10+，内存优化
class Config:
    host: str
    port: int = 8080
    settings: dict[str, str] = field(default_factory=dict)

@dataclass
class Matrix:
    data: list[list[float]] = field(default_factory=lambda: [[0.0, 0.0], [0.0, 0.0]])
```

---

## 路径处理

### pathlib

```python
from pathlib import Path

# ✅ 路径拼接
config_path = Path.home() / ".config" / "app" / "settings.json"
data_dir = Path(".") / "data" / "output"

# ✅ 读写文件
content = config_path.read_text()
config = json.loads(config_path.read_text())
data_path.write_text(json.dumps(data))

# ✅ 目录操作
data_dir.mkdir(parents=True, exist_ok=True)
list(Path(".").glob("**/*.py"))

# ✅ 路径检查
if config_path.exists():
    ...

# ❌ 避免
import os
config_path = os.path.join(os.path.expanduser("~"), ".config", "app")
```

---

## Walrus 运算符（3.8+）

```python
# ✅ 赋值表达式
if (n := len(data)) > 10:
    print(f"Processing {n} items")

# ✅ 列表推导式
[x for x in data if (score := calculate(x)) > 0]

# ✅ while 循环
while (line := file.readline()):
    process(line)

# ❌ 过度使用
result := expensive_computation()  # 仅在需要时才使用
```

---

## match 语句（3.10+）

```python
# ✅ 基础 match
def http_status(code: int) -> str:
    match code:
        case 200:
            return "OK"
        case 404:
            return "Not Found"
        case 500:
            return "Server Error"
        case _:
            return "Unknown"

# ✅ 结构化匹配
def describe_point(point: tuple[float, float]) -> str:
    match point:
        case (0, 0):
            return "Origin"
        case (x, 0):
            return f"On X-axis at {x}"
        case (0, y):
            return f"On Y-axis at {y}"
        case (x, y):
            return f"Point at ({x}, {y})"

# ✅ 带条件的匹配
def classify_number(n: int) -> str:
    match n:
        case n if n < 0:
            return "Negative"
        case 0:
            return "Zero"
        case n if n % 2 == 0:
            return "Even positive"
        case _:
            return "Odd positive"
```
