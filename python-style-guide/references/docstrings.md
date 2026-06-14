# 文档字符串 (Docstring) 规范

---

## 主要风格

| 风格 | 说明 | 适用场景 |
|------|------|----------|
| **Google** | 简洁，基于缩进 | 推荐，大多数项目 |
| **NumPy** | Google 风格扩展，适合科学计算 | NumPy/Pandas 项目 |
| **Sphinx/REST** | 使用 `@param` 等标签 | 文档生成工具 |

---

## Google 风格

### 函数 Docstring

```python
def fetch_user(user_id: int, include_deleted: bool = False) -> User | None:
    """Fetch a user by ID from the database.
    
    Args:
        user_id: The unique identifier of the user.
        include_deleted: If True, include soft-deleted users in results.
    
    Returns:
        User object if found, None otherwise.
    
    Raises:
        DatabaseError: If connection to database fails.
        UserNotFoundError: If user with given ID doesn't exist.
    
    Example:
        >>> user = fetch_user(123)
        >>> print(user.name)
        'Alice'
    """
```

### 类 Docstring

```python
class UserService:
    """Service for managing user operations.
    
    This class provides methods for creating, retrieving, updating,
    and deleting users in the system.
    
    Attributes:
        db: Database connection instance.
        cache: Optional cache backend for performance optimization.
    """
    
    def __init__(self, db: Database, cache: Cache | None = None):
        """Initialize the service.
        
        Args:
            db: Database connection instance.
            cache: Optional cache backend for performance optimization.
        """
```

### 简短 Docstring

```python
def square(x: int) -> int:
    """Return the square of x."""
    return x * x


def validate_email(email: str) -> bool:
    """Validate email format against RFC 822."""
```

---

## NumPy 风格

```python
def compute_correlation_matrix(data: np.ndarray) -> np.ndarray:
    """
    Compute the Pearson correlation coefficients.
    
    Parameters
    ----------
    data : np.ndarray
        2D array of shape (n_samples, n_features).
    
    Returns
    -------
    np.ndarray
        Correlation matrix of shape (n_features, n_features).
    
    Raises
    ------
    ValueError
        If input array is not 2D.
    
    Examples
    --------
    >>> data = np.array([[1, 2], [3, 4]])
    >>> compute_correlation_matrix(data)
    array([[1., 0.5],
           [0.5, 1.]])
    """
```

---

## Sphinx/REST 风格

```python
def fetch_user(user_id):
    """
    Fetch a user by ID from the database.
    
    :param int user_id: The unique identifier of the user.
    :param bool include_deleted: If True, include soft-deleted users.
    :return: User object if found, None otherwise.
    :rtype: User | None
    :raises DatabaseError: If connection to database fails.
    """
```

---

## 模块 Docstring

```python
"""
User management module.

This module provides functionality for:
- User creation and authentication
- Profile management
- Permission handling

Example:
    >>> from myapp.user import UserService
    >>> service = UserService(db)
    >>> user = service.get_user(123)
"""

__all__ = ["UserService", "User", "UserError"]
__version__ = "1.0.0"
```

---

## Docstring 与类型注解的关系

```python
# ✅ 正确：类型说是什么，Docstring 说为什么/怎么用
def find_user(user_id: int) -> dict[str, str] | None:
    """根据 ID 查找用户，查不到返回 None。
    
    Args:
        user_id: 用户 ID必须是正整数。
    """
    ...

# ❌ 错误：Docstring 重复了类型信息
def find_user(user_id: int) -> dict[str, str] | None:
    """接收 int 类型的 user_id，返回 dict[str, str] 或 None。
    
    Parameters:
        user_id (int): 用户 ID
    Returns:
        dict[str, str] | None: 用户信息字典
    """
    ...
```

---

## 特殊方法 Docstring

```python
class Point:
    def __init__(self, x: float, y: float) -> None:
        """Initialize a Point.
        
        Args:
            x: X coordinate.
            y: Y coordinate.
        """
        self.x = x
        self.y = y
    
    def __repr__(self) -> str:
        """Return string representation for debugging."""
        return f"Point(x={self.x}, y={self.y})"
    
    def __str__(self) -> str:
        """Return human-readable string."""
        return f"({self.x}, {self.y})"
    
    def __eq__(self, other: object) -> bool:
        """Check equality with another Point."""
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y
    
    def __hash__(self) -> int:
        """Make Point hashable for use in sets/dicts."""
        return hash((self.x, self.y))
```

---

## 抽象基类 Docstring

```python
from abc import ABC, abstractmethod

class DataProcessor(ABC):
    """Abstract base class for data processors.
    
    Subclasses must implement the `process` method to define
    specific data transformation logic.
    """
    
    @abstractmethod
    def process(self, data: bytes) -> dict:
        """Process raw data into structured format.
        
        Args:
            data: Raw input data in bytes.
        
        Returns:
            Processed data as a dictionary.
        
        Raises:
            ProcessingError: If processing fails.
        """
        ...
```

---

## Docstring 检查工具

```bash
# pydocstyle
pip install pydocstyle
pydocstyle mymodule.py

# darglint（严格文档检查）
pip install darglint
darglint mymodule.py

# 配置
# pyproject.toml
[tool.darglint]
ignore = ["DOC", "SA01"]
```

---

## 最佳实践

### ✅ 推荐

```python
# 1. 描述意图，而非实现
def find(predicate, items):
    """Find the first item matching the predicate."""
    ...

# 2. 包含使用示例
def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime object.
    
    Example:
        >>> parse_date('2024-01-15')
        datetime(2024, 1, 15)
    """
    ...

# 3. 说明副作用和异常
def write_file(path: str, content: str) -> None:
    """Write content to file.
    
    Warning:
        This will overwrite existing files.
    
    Raises:
        PermissionError: If file cannot be written.
    """
    ...
```

### ❌ 避免

```python
# ❌ 空 Docstring
def helper():
    """ """
    ...

# ❌ 废话
def get_length(lst: list) -> int:
    """Get the length of a list."""
    return len(lst)

# ❌ 过时或错误的 Docstring
def process(data):
    """Process data and return result.
    
    Note: This no longer returns a list (changed in v2.0).
    """
    return {"result": data}
```
