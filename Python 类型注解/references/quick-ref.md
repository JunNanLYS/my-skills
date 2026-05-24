# 速查表

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
| `from __future__ import annotations` | ✅ | ✅ | ✅ | ✅ |

---

## 常见代码模式速查

### 函数注解

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
```

### 类注解

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

### 泛型约束

```python
from collections.abc import Sequence

# 约束上界
T = TypeVar("T", bound=Sequence)

# 约束具体类型
N = TypeVar("N", int, float)

# 多类型参数
K = TypeVar("K")
V = TypeVar("V")
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

---

## 工具链建议

| 工具 | 用途 | 常用命令 |
|------|------|----------|
| **mypy** | 静态类型检查 | `mypy src/` |
| **pyright** | 微软出品，更严格 | `npx pyright` |
| **pyre** | Facebook 出品 | `pyre check` |
| **pydantic** | 运行时验证 | — |
| **beartype** | 运行时类型检查 | `@beartype` |

### IDE 配置建议

```json
// pyrightconfig.json（项目根目录）
{
  "include": ["src"],
  "pythonVersion": "3.11",
  "typeCheckingMode": "strict",
  "reportMissingTypeStubs": false
}
```

---

> 🔗 返回：[Level 1](level-1-basic.md) | [Level 2](level-2-containers.md) | [Level 3](level-3-structured.md) | [Level 4](level-4-generics.md) | [Level 5](level-5-runtime.md) | [执行准则](rules.md)
