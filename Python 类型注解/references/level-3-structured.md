# Level 3 — 结构化类型

**适用**：字典/元组形式的数据结构需要明确字段定义。

---

## TypedDict — 带字段的字典

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

### 可选字段

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

### 递归结构

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

---

## NamedTuple — 带名字的元组

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

### NamedTuple 的限制

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

---

## dataclass — 数据类（最推荐）

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

### dataclass 进阶选项

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

### dataclass 方法

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

---

## 三者对比与选型

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
| 适用场景 | API 响应、结构化字典 | 固定元组、坐标 | 业务实体、带行为对象 |

### 选型建议

- **API 响应 / 配置读取 / JSON 数据** → `TypedDict`
- **固定元组 / 坐标 / RGB 颜色** → `NamedTuple`
- **业务对象 / 带方法的数据** → `dataclass`

---

> 🔗 上一节：[Level 2 — 容器与组合](level-2-containers.md)
> 🔗 下一节：[Level 4 — 泛型与抽象](level-4-generics.md)
