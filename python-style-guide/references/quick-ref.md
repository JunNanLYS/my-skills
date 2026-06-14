# 速查表

---

## typing 模块常用符号

| 符号 | 用途 | 示例 |
|------|------|------|
| `list[T]` | 元素为 T 的列表 | `list[int]` |
| `dict[K, V]` | 键 K 值 V 的字典 | `dict[str, int]` |
| `tuple[T, ...]` | 不定长元组 | `tuple[int, ...]` |
| `tuple[A, B]` | 固定长度元组 | `tuple[int, str]` |
| `set[T]` | 元素为 T 的集合 | `set[str]` |
| `frozenset[T]` | 不可变集合 | `frozenset[str]` |
| `T \| None` | 可选值 | `str \| None` |
| `A \| B` | 联合类型 | `int \| str` |
| `Union[A, B]` | 联合类型（旧） | `Union[int, str]` |
| `Optional[T]` | 可选类型（旧） | `Optional[str]` |
| `Callable[[P], R]` | 函数类型 | `Callable[[int], str]` |
| `Iterator[T]` | 迭代器 | `Iterator[int]` |
| `Generator[T, U, V]` | 生成器 | `Generator[int, None, None]` |
| `TypeVar("T")` | 类型变量 | `T = TypeVar("T")` |
| `Generic[T]` | 泛型类 | `class Box(Generic[T])` |
| `Protocol` | 结构化协议 | `class Sized(Protocol)` |
| `TypedDict` | 带字段的字典类型 | `class User(TypedDict)` |
| `NamedTuple` | 具名元组 | `class Point(NamedTuple)` |
| `dataclass` | 数据类 | `@dataclass` |
| `Literal[...]` | 字面值约束 | `Literal["GET","POST"]` |
| `TypeGuard[T]` | 类型收窄守卫 | `-> TypeGuard[list[str]]` |
| `Annotated[T, ...]` | 附加元数据 | `Annotated[int, Field(gt=0)]` |
| `Self` | 返回自身 | `def clone(self) -> Self` |
| `ParamSpec("P")` | 保留参数签名 | 装饰器场景 |
| `overload` | 函数重载 | 多参数类型 |
| `TypeAlias` | 显式类型别名 | `X: TypeAlias = ...` |
| `Any` | 任意类型（慎用） | 最后手段 |
| `TYPE_CHECKING` | 避免循环导入 | `if TYPE_CHECKING:` |
| `NoReturn` | 永不返回 | `def crash() -> NoReturn` |
| `Never` | 永不返回（3.11+） | `def fail() -> Never` |
| `cast(T, x)` | 类型强制转换 | `cast(int, value)` |
| `Type[T]` | 类型本身 | `Type[MyClass]` |
| `ClassVar[T]` | 类变量（非实例） | `count: ClassVar[int]` |

---

## Python 版本兼容速查

| 特性 | 3.8 | 3.9 | 3.10 | 3.11+ |
|------|-----|-----|------|-------|
| `list[int]`（小写容器） | ❌（需 `__future__`）| ✅ | ✅ | ✅ |
| `X \| Y` 联合类型 | ❌ | ❌ | ✅ | ✅ |
| `Self` | ❌ | ❌ | ❌ | ✅ |
| `TypeGuard` | ✅ | ✅ | ✅ | ✅ |
| `ParamSpec` | ❌ | ✅ | ✅ | ✅ |
| `TypeAlias` | ❌ | ❌ | ✅ | ✅ |
| `Never` | ❌ | ❌ | ❌ | ✅ |
| `dataclass(slots=True)` | ❌ | ❌ | ❌ | ✅ |
| `match` 语句 | ❌ | ❌ | ❌ | ✅ |
| `from __future__ import annotations` | ✅ | ✅ | ✅ | ✅ |

---

## 函数注解

```python
# 普通函数
def add(a: int, b: int) -> int: ...

# 可选参数
def greet(name: str, greeting: str | None = None) -> str: ...

# *args 和 **kwargs
def flexible(*args: int, **kwargs: str) -> None: ...

# 异步函数
async def fetch(url: str) -> bytes: ...

# 生成器
def gen(n: int) -> Generator[int, None, None]: ...

# 无返回值
def log(msg: str) -> None: ...
```

---

## 类注解

```python
class MyClass:
    # 实例属性
    name: str

    # 类属性
    count: ClassVar[int] = 0

    # __init__
    def __init__(self, value: int) -> None:
        self.value = value

    # 返回自身
    def copy(self) -> Self: ...

    # 属性（Python 3.10+）
    @property
    def doubled(self) -> int: ...
```

---

## 常见错误对照

| 错误写法 | 正确写法 | 说明 |
|----------|----------|------|
| `def f(x: int = None)` | `def f(x: int \| None = None)` | 可选参数要加 `\| None` |
| `List[int]`（无 import） | `list[int]`（3.9+） | 小写类型无需 import |
| `def f() -> dict` | `def f() -> dict[str, Any]` | 字典要有键值类型 |
| `def f(x: Any) -> Any` | 用 Union/Protocol/TypeGuard | 避免 Any |
| `x: list = []` | `x: list[int] = []` | 变量也要标注 |
| `@overload` 无非重载实现 | 最后一个 def 是实现 | overload 只是签名 |
| `if x == None:` | `if x is None:` | 使用 is 比较 |
| `if len(x) == 0:` | `if not x:` | 使用 truthiness |

---

## 工具链速查

| 工具 | 用途 | 常用命令 |
|------|------|----------|
| **ruff** | Linter + 格式化 | `ruff check . --fix` |
| **black** | 代码格式化 | `black .` |
| **isort** | 导入排序 | `isort .` |
| **mypy** | 静态类型检查 | `mypy src/` |
| **pyright** | 微软类型检查 | `pyright src/` |
| **pytest** | 测试 | `pytest -v` |
| **pytest-cov** | 测试覆盖率 | `pytest --cov=src` |
| **bandit** | 安全检查 | `bandit -r src/` |
| **pip-audit** | 依赖漏洞 | `pip-audit` |

### IDE 配置示例

```json
// pyrightconfig.json
{
  "include": ["src"],
  "pythonVersion": "3.11",
  "typeCheckingMode": "strict",
  "reportMissingTypeStubs": false
}
```

---

## PEP 8 速查

| 场景 | 规则 |
|------|------|
| 缩进 | 4 空格 |
| 行长度 | 88（Black）/79（严格） |
| 导入顺序 | stdlib → 第三方 → 本地 |
| 函数命名 | `snake_case` |
| 类命名 | `PascalCase` |
| 常量命名 | `UPPER_CASE` |
| 私有属性 | `_single_underscore` |
| 运算符空格 | `a + b`, `x = 1` |
| 括号内 | `func(a, b)`, `d = {"a": 1}` |
| 类间距 | 两空行分隔顶级定义 |
| 方法间距 | 一空行分隔类方法 |

---

## Pythonic 模式速查

```python
# 推导式
squares = [x**2 for x in range(10)]
lookup = {item.id: item for item in items}

# 上下文管理器
with open("f") as f:
    data = f.read()

# 解包
a, *rest, b = items
a, b = b, a  # 交换

# EAFP
try:
    value = d[key]
except KeyError:
    value = default

# f-string
msg = f"Hello {name}"

# pathlib
from pathlib import Path
Path.home() / ".config" / "app"

# enumerate
for i, item in enumerate(items):
    ...

# join
result = "".join(str(x) for x in items)
```

---

## 反模式速查

```python
# ❌ 可变默认参数
def bad(x=[]): ...

# ✅
def good(x=None):
    x = x or []

# ❌ 裸 except
except: ...

# ✅
except ValueError as e: ...

# ❌ == None
if x == None: ...

# ✅
if x is None: ...

# ❌ len() 判断空
if len(x) == 0: ...

# ✅
if not x: ...

# ❌ 循环内拼接
result = ""
for x in items:
    result += str(x)

# ✅
result = "".join(str(x) for x in items)

# ❌ import *
from os import *

# ✅
import os
```

---

## 数据类对比

| 特性 | TypedDict | NamedTuple | dataclass |
|------|-----------|------------|-----------|
| JSON 支持 | ✅ | ❌ | ⚠️ |
| 属性访问 | ❌ | ✅ | ✅ |
| 可变 | ✅ | ❌ | ✅ |
| 方法 | ❌ | ❌ | ✅ |
| 适用场景 | API 响应 | 坐标/元组 | 业务对象 |

---

> 🔗 返回：[SKILL.md](../SKILL.md) | [type-annotations.md](type-annotations.md)
