# 类型注解完整指南

> 渐进式披露类型注解知识，从基础到高级。

---

## 层级导航

| 层级 | 内容 | 适合场景 |
|------|------|----------|
| [Level 1](#level-1--基础标注) | 基础类型、函数注解 | 入门 |
| [Level 2](#level-2--容器与组合) | 容器类型、Union/Optional、Callable | 中级 |
| [Level 3](#level-3--结构化类型) | TypedDict、NamedTuple、dataclass | 数据建模 |
| [Level 4](#level-4--泛型与抽象) | TypeVar、Generic、Protocol、Self | 泛型编程 |
| [Level 5](#level-5--运行时守卫) | Literal、TypeGuard、Annotated、overload | 高级类型控制 |
| [执行准则](#执行准则) | 强制规范 | 严格遵循 |

---

## Level 1 — 基础标注

**适用**：函数参数和返回值加上简单类型注解。

### 内置基本类型

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

### 变量注解

```python
name: str = "Alice"
count: int = 0
ratio: float = 0.5
active: bool = True
```

### Python 版本说明

```
Python 3.9+：list[int]、dict[str, int]（小写，无需导入）
Python 3.8 以下：from typing import List, Dict（大写）
```

> **规则**：优先使用 3.9+ 小写语法，若需兼容旧版本再用 `typing` 大写形式。

### 常见内置类型速查

| 类型 | 说明 | 示例 |
|------|------|------|
| `str` | 字符串 | `"hello"` |
| `int` | 整数 | `42` |
| `float` | 浮点数 | `3.14` |
| `bool` | 布尔值 | `True` / `False` |
| `bytes` | 字节串 | `b"data"` |
| `None` | 空值 | 返回值标 `-> None` |

### 注意事项

1. `__init__` 方法：返回值标 `-> None`
2. `__str__` / `__repr__`：返回类型标 `-> str`
3. 生成器函数：返回值标 `Iterator[T]` 或 `Generator[T, None, None]`

```python
def __init__(self, name: str) -> None:
    self.name = name

def __str__(self) -> str:
    return self.name
```

> 🔗 下一节：[Level 2 — 容器与组合](#level-2--容器与组合)

---

## Level 2 — 容器与组合

**适用**：集合类型、可选值、多类型联合。

### 容器类型（3.9+ 原生语法）

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

### Optional（可为 None）

```python
# 方式一：X | None（3.10+ 推荐）
def find_user(user_id: int) -> dict[str, str] | None:
    ...

# 方式二：Optional[X]（3.9 以下兼容）
from typing import Optional
def find_user(user_id: int) -> Optional[dict[str, str]]:
    ...
```

### Union（多种类型之一）

```python
# 3.10+ 用 | 运算符
def parse(value: str | int | float) -> float:
    return float(value)

# 3.9 以下
from typing import Union
def parse(value: Union[str, int, float]) -> float:
    return float(value)
```

### Callable（函数类型）

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

### Any（最后手段）

```python
from typing import Any

# ⚠️ 仅当类型真的无法确定时使用，避免滥用
def deserialize(data: Any) -> dict[str, Any]:
    ...
```

### Iterator / Generator

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

### 常用组合模式

| 场景 | 注解 | 说明 |
|------|------|------|
| 可选字符串 | `str \| None` | 3.10+ |
| 可选整数 | `int \| None` | 3.10+ |
| 字符串或数字 | `str \| int` | 3.10+ |
| 返回列表的函数 | `-> list[str]` | 返回字符串列表 |
| 字典值是列表 | `dict[str, list[int]]` | 嵌套容器 |
| 可选回调 | `Callable[..., void] \| None` | 可选函数参数 |

> 🔗 上一节：[Level 1](#level-1--基础标注)
> 🔗 下一节：[Level 3 — 结构化类型](#level-3--结构化类型)

---

## Level 3 — 结构化类型

**适用**：字典/元组形式的数据结构需要明确字段定义。

### TypedDict — 带字段的字典

```python
from typing import TypedDict

class UserInfo(TypedDict):
    name: str
    age: int
    email: str

# 使用
def create_user(info: UserInfo) -> None:
    print(info["name"])
    print(info["age"])  # 类型检查器知道这是 int

# TypedDict 本质是 dict，可以直接 JSON 序列化
import json
user: UserInfo = {"name": "Alice", "age": 30, "email": "alice@example.com"}
json_str = json.dumps(user)  # ✅ 天然兼容
```

#### 可选字段

```python
# 方式一：total=False（所有字段变为可选）
class UserPartial(TypedDict, total=False):
    name: str
    age: int
    email: str   # 所有字段都是可选的

# 方式二：继承分层（推荐）
class UserRequired(TypedDict):
    name: str

class UserFull(UserRequired, total=False):
    age: int
    email: str

# 使用
def register(user: UserRequired) -> UserFull:
    return {"name": user["name"], "age": 0, "email": ""}
```

#### 递归结构

```python
class TreeNode(TypedDict, total=False):
    value: str
    children: list["TreeNode"]  # 字符串形式的类型注解

# 或者在文件顶部加上 from __future__ import annotations
from __future__ import annotations
class TreeNode(TypedDict, total=False):
    value: str
    children: list[TreeNode]
```

### NamedTuple — 带名字的元组

```python
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
    z: float = 0.0   # 有默认值

# 使用
p = Point(1.0, 2.0)
print(p.x, p.y)   # 可以用属性访问 ✅
print(p[0])       # 也可以用索引 ✅

# 解包
px, py, pz = Point(1.0, 2.0)
```

#### NamedTuple 的限制

- 字段数量固定，不可增减
- 所有字段默认可比较（用于排序）
- 不能添加实例方法（Python 3.6+ 可以）

```python
class Point3D(NamedTuple):
    x: float
    y: float
    z: float

    # ⚠️ 方法不行（NamedTuple 不支持自定义方法）
    # def distance_from_origin(self) -> float: ...

# 如需方法，用 dataclass 代替
```

### dataclass — 数据类（最推荐）

```python
from dataclasses import dataclass, field

@dataclass
class Config:
    host: str
    port: int = 8080              # 有默认值
    tags: list[str] = field(default_factory=list)  # 可变默认值用 field
    enabled: bool = True

# 使用
config = Config(host="localhost", port=9000)
print(config.host)
config.tags.append("production")

# 自动生成 __init__、__repr__、__eq__
config2 = Config(host="localhost", port=9000)
print(config == config2)  # ✅ True
```

#### dataclass 进阶选项

```python
from dataclasses import dataclass, field

@dataclass(order=True)      # 自动生成比较方法
@dataclass(slots=True)     # Python 3.10+，内存优化
@dataclass(frozen=True)    # 不可变对象
class ImmutablePoint:
    x: float
    y: float

# 字段默认值工厂
@dataclass
class Matrix:
    data: list[list[float]] = field(default_factory=lambda: [[0.0, 0.0], [0.0, 0.0]])

# 字段元数据
@dataclass
class FieldWithMeta:
    name: str = field(hash=False, compare=True)
    secret: str = field(hash=False, compare=False)  # 不参与比较和哈希
```

#### dataclass 方法

```python
@dataclass
class Rectangle:
    width: float
    height: float

    def area(self) -> float:
        return self.width * self.height

    def __post_init__(self) -> None:
        # 初始化后验证
        if self.width < 0 or self.height < 0:
            raise ValueError("宽和高必须为正数")
```

### 三者对比与选型

| 特性 | TypedDict | NamedTuple | dataclass |
|------|-----------|------------|-----------|
| 底层类型 | `dict` | `tuple` | 普通类 |
| 可变 | ✅ | ❌ | ✅（默认）|
| JSON 序列化 | ✅ 天然支持 | ❌ | ⚠️ 需手动或用 `asdict` |
| 属性访问 | ❌ `dict["key"]` | ✅ `point.x` | ✅ `obj.x` |
| 默认值 | ✅ `total=False` | ✅ 支持 | ✅ 支持 |
| 方法 | ❌ | ❌ | ✅ |
| 继承 | 有限 | ✅ 支持 | ✅ 支持 |
| 不可变性 | ❌ | ✅（用 `frozen=True`） | ✅（用 `frozen=True`） |
| 适用场景 | API 响应、结构化字典 | 固定元组、坐标、RGB 颜色 | 业务实体、带行为对象 |

### 选型建议

- **API 响应 / 配置读取 / JSON 数据** → `TypedDict`
- **固定元组 / 坐标 / RGB 颜色** → `NamedTuple`
- **业务对象 / 带方法的数据** → `dataclass`

> 🔗 上一节：[Level 2](#level-2--容器与组合)
> 🔗 下一节：[Level 4 — 泛型与抽象](#level-4--泛型与抽象)

---

## Level 4 — 泛型与抽象

**适用**：写工具函数、基类、框架代码，需要类型在调用时才确定。

### TypeVar — 类型变量

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

#### 带约束的 TypeVar

```python
# 限定只能是数字类型
Numeric = TypeVar("Numeric", int, float)

def double(value: Numeric) -> Numeric:
    return value * 2

double(5)    # ✅ int
double(3.14) # ✅ float
# double("hi")  # ❌ 报错
```

#### 绑定上界的 TypeVar

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

### Generic — 泛型类

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

#### 多类型参数的 Generic

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

### Protocol — 结构化子类型（鸭子类型）

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

#### 预定义 Protocol（typing 自带）

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

### Self — 返回自身实例（3.11+）

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

#### 3.10 以下用 TypeVar 模拟

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

### ParamSpec — 保留参数签名（装饰器必备）

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

#### 组合多个泛型工具

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

### 常见泛型工具函数示例

```python
from typing import TypeVar, Generic, Callable

T = TypeVar("T")
K = TypeVar("K")

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
def group_by(items: list[T], key_func: Callable[[T], K]) -> dict[K, list[T]]:
    groups: dict[K, list[T]] = {}
    for item in items:
        key = key_func(item)
        if key not in groups:
            groups[key] = []
        groups[key].append(item)
    return groups
```

> 🔗 上一节：[Level 3](#level-3--结构化类型)
> 🔗 下一节：[Level 5 — 运行时守卫](#level-5--运行时守卫)

---

## Level 5 — 运行时守卫

**适用**：动态类型收窄、值域约束、运行时验证。

### Literal — 限定具体值

```python
from typing import Literal

Direction = Literal["north", "south", "east", "west"]
HTTPMethod = Literal["GET", "POST", "PUT", "DELETE"]
Status = Literal[200, 404, 500]

def move(direction: Direction) -> None:
    ...

move("north")   # ✅
move("up")      # ❌ 类型检查器报错

def handle_request(method: HTTPMethod, path: str) -> Status:
    ...

handle_request("GET", "/api/users")   # ✅
handle_request("PATCH", "/api/users") # ❌
```

#### 配合函数默认值

```python
from typing import Literal

def query(
    sql: str,
    mode: Literal["single", "batch"] = "single",
    timeout: int = 30,
) -> list[dict]:
    ...

query("SELECT * FROM users", mode="batch")  # ✅
query("SELECT * FROM users", mode="stream") # ❌
```

### TypeGuard — 自定义类型守卫

**作用**：让类型检查器在条件分支中自动收窄类型。

```python
from typing import TypeGuard

def is_string_list(val: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in val)

def process(items: list[object]) -> None:
    if is_string_list(items):
        # 类型收窄为 list[str]
        print(items[0].upper())  # ✅ .upper() 存在
        print(len(items[0]))     # ✅ .upper() 返回 str
    else:
        print(items[0])  # 仍是 list[object]
```

#### 常见 TypeGuard 模式

```python
from typing import TypeGuard, Any

# 检查是否为字典
def is_dict(val: Any) -> TypeGuard[dict]:
    return isinstance(val, dict)

# 检查字典是否包含特定键
def has_required_keys(data: dict, *keys: str) -> TypeGuard[dict[str, Any]]:
    return all(key in data for key in keys)

def process_config(data: dict) -> None:
    if has_required_keys(data, "host", "port"):
        # data 被收窄为 dict[str, Any]
        print(data["host"].upper())  # ✅
```

### Annotated — 附加元数据

```python
from typing import Annotated

# 为类型附加说明（纯元数据，不影响类型检查）
UserId = Annotated[int, "用户 ID，必须为正整数"]
Email = Annotated[str, "邮箱地址，必须包含 @ 符号"]

def get_user(user_id: UserId) -> None:
    ...

get_user(123)   # ✅ 通过类型检查（但无运行时验证）
```

#### 配合 Pydantic 做运行时验证

```python
# Pydantic v2 风格
from typing import Annotated
from pydantic import Field, BaseModel

PositiveInt = Annotated[int, Field(gt=0, description="必须为正整数")]
EmailStr = Annotated[str, Field(min_length=1, pattern=r".+@.+\..+")]

class CreateUser(BaseModel):
    user_id: PositiveInt
    email: EmailStr
    name: str = Field(max_length=50)

# 运行时自动验证，不合法抛出 ValidationError
user = CreateUser(user_id=-1, email="invalid")  # ❌ 报错
```

#### 配合 FastAPI

```python
from fastapi import FastAPI, Query
from typing import Annotated

app = FastAPI()

@app.get("/users")
def get_users(
    limit: Annotated[int, Query(gt=0, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict]:
    ...
    # FastAPI 自动从 Annotated 提取验证规则
```

### TypeAlias — 显式类型别名（3.10+）

```python
from typing import TypeAlias

Vector: TypeAlias = list[float]
Matrix: TypeAlias = list[list[float]]
SparseMatrix: TypeAlias = dict[tuple[int, int], float]

def dot(a: Vector, b: Vector) -> float:
    return sum(x * y for x, y in zip(a, b))

def mat_mul(a: Matrix, b: Matrix) -> Matrix:
    ...
```

#### TypeAlias 与 Generic 组合

```python
from typing import TypeAlias, TypeVar

K = TypeVar("K")
V = TypeVar("V")

Pair: TypeAlias = tuple[K, V]
Map: TypeAlias = dict[K, list[V]]

# 明确标注
def first_pair(pairs: list[Pair[str, int]]) -> str:
    return pairs[0][0]
```

### overload — 函数重载签名

**场景**：同一函数名在不同参数组合下有不同行为。

```python
from typing import overload

@overload
def process(value: int) -> int: ...
    # 参数是 int，返回 int

@overload
def process(value: str) -> str: ...
    # 参数是 str，返回 str

@overload
def process(value: list[int]) -> int: ...
    # 参数是 int 列表，返回 int 总和

def process(value: int | str | list[int]) -> int | str:
    if isinstance(value, int):
        return value * 2
    if isinstance(value, str):
        return value.upper()
    return sum(value)

# 使用
process(5)          # -> int (调用第一个重载)
process("hello")    # -> str (调用第二个重载)
process([1, 2, 3])  # -> int (调用第三个重载)
```

#### 典型场景：可选返回类型

```python
from typing import overload

@overload
def parse(value: str) -> dict[str, str]: ...
@overload
def parse(value: str, strict: bool) -> dict[str, str] | None: ...

def parse(value: str, strict: bool = False) -> dict[str, str] | None:
    data = parse_impl(value)
    if strict and not is_valid(data):
        return None
    return data
```

### TYPE_CHECKING — 避免循环导入

```python
# a.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # 仅在类型检查阶段导入，运行时不执行
    from b import HeavyModel

def use_model(model: "HeavyModel") -> None:
    # model 是 "HeavyModel" 类型注解，运行时不实际导入
    ...

# b.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from a import use_model

class HeavyModel:
    def __init__(self, data: list[str]) -> None:
        self.data = data
```

### 进阶组合：自定义类型守卫工厂

```python
from typing import TypeGuard, Callable, Any

def make_guard(
    check: Callable[[Any], bool],
    target_type: type,
) -> Callable[[Any], TypeGuard[target_type]]:
    def guard(value: Any) -> TypeGuard[target_type]:
        return check(value)
    return guard

# 创建守卫
is_positive_int: Callable[[Any], TypeGuard[int]] = make_guard(
    lambda x: isinstance(x, int) and x > 0,
    int,
)

def process(value: Any) -> None:
    if is_positive_int(value):
        print(value + 1)  # ✅ int
```

> 🔗 上一节：[Level 4](#level-4--泛型与抽象)
> 🔗 返回：[执行准则](#执行准则) | [速查表](quick-ref.md)

---

## 执行准则

> 写类型注解时必须遵守的强制规范，无例外。

### 1. 强制标注

所有 `def` 函数的**参数**和**返回值**都必须有类型注解。

```python
# ✅ 正确
def add(a: int, b: int) -> int:
    return a + b

# ❌ 错误：缺少类型注解
def add(a, b):
    return a + b
```

**特殊情况**：
- `__init__`：返回值标 `-> None`
- `__str__` / `__repr__`：返回标 `-> str`
- 抽象方法（`@abstractmethod`）：必须有注解

### 2. 现代语法优先

| 场景 | 推荐（3.9+/3.10+） | 旧写法（3.8） |
|------|--------------------|--------------|
| 联合类型 | `int \| str` | `Union[int, str]` |
| 可选类型 | `str \| None` | `Optional[str]` |
| 列表类型 | `list[int]` | `List[int]` |
| 字典类型 | `dict[str, int]` | `Dict[str, int]` |
| 返回自身 | `-> Self` | TypeVar 模拟 |
| 类型别名 | `X: TypeAlias = ...` | 普通赋值 |

> 💡 在文件顶部加 `from __future__ import annotations` 可让大多数新语法在注解层面向后兼容 3.8（运行时不生效）。

### 3. 禁止滥用 Any

滥用 `Any` 等于放弃类型检查。替代方案：

| 滥用场景 | 正确做法 |
|----------|----------|
| 类型真的不确定 | 用 `object` + TypeGuard 逐层收窄 |
| 多种类型之一 | 用 `Union` / `\|` |
| 鸭子类型 | 用 `Protocol` |
| 泛型但不确定元素 | 用 `TypeVar(..., bound=...)` |
| 任意返回值 | 用 `Any`，但必须注释说明原因 |

```python
# ❌ 滥用 Any
def process(data: Any) -> Any:
    return data

# ✅ 改进：明确可能的类型
def process(data: dict[str, Any]) -> dict[str, Any] | None:
    ...

# ✅ 更优：TypedDict + TypeGuard
def is_valid_config(data: object) -> TypeGuard[dict[str, str | int]]:
    return isinstance(data, dict) and ...

def process(data: object) -> None:
    if is_valid_config(data):
        print(data["key"])  # 收窄为 dict[str, str | int]
```

### 4. 复杂结构必须命名

重复出现的匿名类型必须提取为命名类型：

```python
# ❌ 重复匿名类型，难以维护
def merge(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    ...

def transform(data: dict[str, Any]) -> list[dict[str, Any]]:
    ...

# ✅ 提取为 TypedDict
class Record(TypedDict):
    key: str
    value: str | int

def merge(a: Record, b: Record) -> Record:
    ...

def transform(data: Record) -> list[Record]:
    ...
```

### 5. 返回自身实例用 Self

```python
# 3.11+ 推荐
class Builder:
    def set_name(self, name: str) -> Self:
        self.name = name
        return self

# 3.10 以下
from typing import TypeVar
_T = TypeVar("_T", bound="Builder")

class Builder:
    def set_name(self: _T, name: str) -> _T:
        self.name = name
        return self
```

### 6. Docstring 与类型不重复

类型注解已经表达类型信息，Docstring 只写**逻辑含义**：

```python
# ✅ 正确：类型说是什么，Docstring 说为什么
def find_user(user_id: int) -> dict[str, str] | None:
    """根据 ID 查找用户，查不到返回 None。"""
    ...

# ❌ 错误：Docstring 重复了类型信息
def find_user(user_id: int) -> dict[str, str] | None:
    """接收 int 类型的 user_id，返回 dict[str, str] 或 None。"""
    ...
```

### 7. 渐进添加

存量代码按模块逐步添加，不要求一次全量修改。

**优先级**：
1. 新增代码必须立即标注
2. 高风险区域优先（外部 API、数据库、文件 IO）
3. 公共接口优先（导出函数、类）
4. 内部实现后补

### 8. 避免类型注解过度工程

类型注解是工具，不是目的。适度即可：

```python
# ✅ 适度：简单明了
def greet(name: str) -> str:
    return f"Hello, {name}"

# ❌ 过度：为了泛型而泛型
def greet(name: str) -> str:
    T = TypeVar("T")
    # ... 不必要的复杂度
```
