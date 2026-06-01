# Level 4 — 泛型与抽象

**适用**：写工具函数、基类、框架代码，需要类型在调用时才确定。

---

## TypeVar — 类型变量

```python
from typing import TypeVar

T = TypeVar("T")

# 返回类型与输入类型相同
def first(items: list[T]) -> T:
    return items[0]

first([1, 2, 3])       # 推断为 int
first(["a", "b"])      # 推断为 str
first([True, False])   # 推断为 bool
```

### 带约束的 TypeVar

```python
# 限定只能是数字类型
Numeric = TypeVar("Numeric", int, float)

def double(value: Numeric) -> Numeric:
    return value * 2

double(5)    # ✅ int
double(3.14) # ✅ float
# double("hi")  # ❌ 报错
```

### 绑定上界的 TypeVar

```python
from typing import TypeVar
from collections.abc import Sequence

T = TypeVar("T", bound=Sequence)  # T 必须是 Sequence 的子类

def first_item(items: T) -> T:
    return items[0]

first_item([1, 2, 3])       # ✅ list[int]
first_item((4, 5, 6))       # ✅ tuple[int, ...]
# first_item(123)           # ❌ 123 不是 Sequence
```

---

## Generic — 泛型类

```python
from typing import Generic, TypeVar

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def is_empty(self) -> bool:
        return len(self._items) == 0

# 使用时指定类型
stack: Stack[int] = Stack()
stack.push(1)
value: int = stack.pop()
```

### 多类型参数的 Generic

```python
from typing import Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")

class Pair(Generic[K, V]):
    def __init__(self, key: K, value: V) -> None:
        self.key = key
        self.value = value

    def both(self) -> tuple[K, V]:
        return (self.key, self.value)

pair: Pair[str, int] = Pair("age", 30)
k: str = pair.key
v: int = pair.value
```

---

## Protocol — 结构化子类型（鸭子类型）

**核心思想**：不用继承，只看"有没有这些方法"。

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...
    def resize(self, factor: float) -> None: ...

class Circle:
    def draw(self) -> None:
        print("画圆")

    def resize(self, factor: float) -> None:
        self.radius *= factor

    # 不需要显式继承 Drawable
    radius: float = 1.0

# 类型检查器认为 Circle 满足 Drawable 协议
def render(shape: Drawable) -> None:
    shape.draw()

render(Circle())   # ✅ 类型检查通过
```

### 预定义 Protocol（typing 自带）

```python
from typing import Protocol
from collections.abc import Sized, Iterable, Iterator

class Cache(Protocol):
    def __len__(self) -> int: ...       # 实现 Sized
    def __contains__(self, key: str) -> bool: ...
    def get(self, key: str) -> str | None: ...

# 任何有 __len__ 和 __contains__ 的对象都满足
class SimpleDict(dict):
    ...

cache: Cache = SimpleDict()
```

---

## Self — 返回自身实例（3.11+）

```python
from typing import Self

class Builder:
    def set_name(self, name: str) -> Self:
        self.name = name
        return self

    def set_age(self, age: int) -> Self:
        self.age = age
        return self

    def build(self) -> dict[str, str | int]:
        return {"name": self.name, "age": self.age}

# 链式调用
result = Builder().set_name("Alice").set_age(30).build()

# 子类继承后返回类型自动变为子类
class ExtendedBuilder(Builder):
    def set_extra(self, extra: str) -> Self:
        self.extra = extra
        return self

# 返回类型是 ExtendedBuilder，不是 Builder
eb = ExtendedBuilder().set_name("Bob").set_extra("data")
```

### 3.10 以下用 TypeVar 模拟

```python
from typing import TypeVar

_T = TypeVar("_T", bound="Builder")

class Builder:
    def set_name(self: _T, name: str) -> _T:
        self.name = name
        return self

    def set_age(self: _T, age: int) -> _T:
        self.age = age
        return self
```

---

## ParamSpec — 保留参数签名（装饰器必备）

```python
from typing import ParamSpec, Callable, TypeVar
import functools

P = ParamSpec("P")
R = TypeVar("R")

def log_call(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"调用 {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log_call
def add(a: int, b: int) -> int:
    return a + b

result = add(1, 2)   # 类型检查器知道返回 int
```

### 组合多个泛型工具

```python
from typing import ParamSpec, TypeVar, Callable
import functools

P = ParamSpec("P")
R = TypeVar("R")
T = TypeVar("T")

# 缓存装饰器，保留原始函数签名
def memoize(func: Callable[P, R]) -> Callable[P, R]:
    cache: dict[tuple, R] = {}

    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        key = (args, tuple(sorted(kwargs.items())))
        if key not in cache:
            cache[key] = func(*args, **kwargs)
        return cache[key]
    return wrapper
```

---

## 常见泛型工具函数示例

```python
from typing import TypeVar, Generic

T = TypeVar("T")

# 去重，保持顺序
def dedup(items: list[T]) -> list[T]:
    seen: set[T] = set()
    result: list[T] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

# 分组
K = TypeVar("K")

def group_by(items: list[T], key_func: Callable[[T], K]) -> dict[K, list[T]]:
    groups: dict[K, list[T]] = {}
    for item in items:
        key = key_func(item)
        if key not in groups:
            groups[key] = []
        groups[key].append(item)
    return groups
```

---

> 🔗 上一节：[Level 3 — 结构化类型](level-3-structured.md)
> 🔗 下一节：[Level 5 — 运行时守卫](level-5-runtime.md)
