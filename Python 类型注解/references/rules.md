# 执行准则

> 写类型注解时必须遵守的强制规范，无例外。

---

## 1. 强制标注

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

---

## 2. 现代语法优先

| 场景 | 推荐（3.9+/3.10+） | 旧写法（3.8） |
|------|--------------------|--------------|
| 联合类型 | `int \| str` | `Union[int, str]` |
| 可选类型 | `str \| None` | `Optional[str]` |
| 列表类型 | `list[int]` | `List[int]` |
| 字典类型 | `dict[str, int]` | `Dict[str, int]` |
| 返回自身 | `-> Self` | TypeVar 模拟 |
| 类型别名 | `X: TypeAlias = ...` | 普通赋值 |

> 💡 在文件顶部加 `from __future__ import annotations` 可让大多数新语法在注解层面向后兼容 3.8（运行时不生效）。

---

## 3. 禁止滥用 Any

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

---

## 4. 复杂结构必须命名

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

---

## 5. 返回自身实例用 Self

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

---

## 6. Docstring 与类型不重复

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

---

## 7. 渐进添加

存量代码按模块逐步添加，不要求一次全量修改。

**优先级**：
1. 新增代码必须立即标注
2. 高风险区域优先（外部 API、数据库、文件 IO）
3. 公共接口优先（导出函数、类）
4. 内部实现后补

---

## 8. 避免类型注解过度工程

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

---

> 🔗 返回：[Level 1](level-1-basic.md) | [Level 2](level-2-containers.md) | [Level 3](level-3-structured.md) | [Level 4](level-4-generics.md) | [Level 5](level-5-runtime.md) | [速查表](quick-ref.md)
