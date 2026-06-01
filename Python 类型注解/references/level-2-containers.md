# Level 2 — 容器与组合

**适用**：集合类型、可选值、多类型联合。

---

## 容器类型（3.9+ 原生语法）

```python
# 列表：元素类型写在 [] 内
def process(items: list[int]) -> list[str]:
    return [str(i) for i in items]

# 字典：[键类型, 值类型]
def count_words(text: str) -> dict[str, int]:
    ...

# 元组：固定长度写出每个元素类型
def get_point() -> tuple[int, int]:
    return (0, 0)

# 不定长元组：tuple[int, ...]
def average(values: tuple[float, ...]) -> float:
    return sum(values) / len(values)

# 集合
def unique_ids(data: list[int]) -> set[int]:
    return set(data)
```

---

## Optional（可为 None）

```python
# 方式一：X | None（3.10+ 推荐）
def find_user(user_id: int) -> dict[str, str] | None:
    ...

# 方式二：Optional[X]（3.9 以下兼容）
from typing import Optional
def find_user(user_id: int) -> Optional[dict[str, str]]:
    ...
```

---

## Union（多种类型之一）

```python
# 3.10+ 用 | 运算符
def parse(value: str | int | float) -> float:
    return float(value)

# 3.9 以下
from typing import Union
def parse(value: Union[str, int, float]) -> float:
    return float(value)
```

---

## Callable（函数类型）

```python
from typing import Callable

# Callable[[参数类型, ...], 返回类型]
def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

# 无参数的回调
def on_ready(callback: Callable[[], None]) -> None:
    callback()

# 可变参数
def call_all(callbacks: list[Callable[[], None]]) -> None:
    for cb in callbacks:
        cb()
```

---

## Any（最后手段）

```python
from typing import Any

# ⚠️ 仅当类型真的无法确定时使用，避免滥用
def deserialize(data: Any) -> dict[str, Any]:
    ...
```

---

## Iterator / Generator

```python
from typing import Iterator, Generator

def countdown(n: int) -> Generator[int, None, None]:
    while n > 0:
        yield n
        n -= 1

def integers() -> Iterator[int]:
    i = 0
    while True:
        yield i
        i += 1
```

---

## 常用组合模式

| 场景 | 注解 | 说明 |
|------|------|------|
| 可选字符串 | `str \| None` | 3.10+ |
| 可选整数 | `int \| None` | 3.10+ |
| 字符串或数字 | `str \| int` | 3.10+ |
| 返回列表的函数 | `-> list[str]` | 返回字符串列表 |
| 字典值是列表 | `dict[str, list[int]]` | 嵌套容器 |
| 可选回调 | `Callable[..., void] \| None` | 可选函数参数 |

---

> 🔗 上一节：[Level 1 — 基础标注](level-1-basic.md)
> 🔗 下一节：[Level 3 — 结构化类型](level-3-structured.md)
