# Level 1 — 基础标注

**适用**：函数参数和返回值加上简单类型注解。

---

## 内置基本类型

```python
# 参数: name 是字符串，age 是整数；返回值是字符串
def greet(name: str, age: int) -> str:
    return f"你好 {name}，你今年 {age} 岁"

# 没有返回值用 None
def log(message: str) -> None:
    print(message)

# 布尔值
def is_adult(age: int) -> bool:
    return age >= 18

# 浮点数
def bmi(weight: float, height: float) -> float:
    return weight / (height ** 2)
```

---

## 变量注解

```python
name: str = "Alice"
count: int = 0
ratio: float = 0.5
active: bool = True
```

---

## Python 版本说明

```
Python 3.9+：list[int]、dict[str, int]（小写，无需导入）
Python 3.8 以下：from typing import List, Dict（大写）
```

> 📌 **规则**：优先使用 3.9+ 小写语法，若需兼容旧版本再用 `typing` 大写形式。

---

## 常见内置类型速查

| 类型 | 说明 | 示例 |
|------|------|------|
| `str` | 字符串 | `"hello"` |
| `int` | 整数 | `42` |
| `float` | 浮点数 | `3.14` |
| `bool` | 布尔值 | `True` / `False` |
| `bytes` | 字节串 | `b"data"` |
| `None` | 空值 | 返回值标 `-> None` |

---

## 注意事项

1. **`__init__` 方法**：返回值标 `None`，即使隐式返回实例
2. **`__str__` / `__repr__`**：返回类型标 `str`
3. **生成器函数**：返回值标 `Iterator[T]` 或 `Generator[T, None, None]`

```python
def __init__(self, name: str) -> None:
    self.name = name

def __str__(self) -> str:
    return self.name
```

---

> 🔗 下一节：[Level 2 — 容器与组合](level-2-containers.md)
