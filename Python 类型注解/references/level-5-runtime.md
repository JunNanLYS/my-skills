# Level 5 — 运行时守卫

**适用**：动态类型收窄、值域约束、运行时验证。

---

## Literal — 限定具体值

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

### 配合函数默认值

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

---

## TypeGuard — 自定义类型守卫

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

### 常见 TypeGuard 模式

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

---

## Annotated — 附加元数据

```python
from typing import Annotated

# 为类型附加说明（纯元数据，不影响类型检查）
UserId = Annotated[int, "用户 ID，必须为正整数"]
Email = Annotated[str, "邮箱地址，必须包含 @ 符号"]

def get_user(user_id: UserId) -> None:
    ...

get_user(123)   # ✅ 通过类型检查（但无运行时验证）
```

### 配合 Pydantic 做运行时验证

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

### 配合 FastAPI

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

---

## TypeAlias — 显式类型别名（3.10+）

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

### TypeAlias 与 Generic 组合

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

---

## overload — 函数重载签名

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

### 典型场景：可选返回类型

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

---

## TYPE_CHECKING — 避免循环导入

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

---

## 进阶组合：自定义类型守卫工厂

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

---

> 🔗 上一节：[Level 4 — 泛型与抽象](level-4-generics.md)
> 🔗 返回：[执行准则](rules.md) | [速查表](quick-ref.md)
