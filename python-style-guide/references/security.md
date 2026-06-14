# 安全编码规范

---

## 敏感信息处理

### ❌ 禁止硬编码

```python
# ❌ 危险 - 敏感信息硬编码
API_KEY = "sk-1234567890abcdef"
DB_PASSWORD = "secret123"
SECRET_KEY = "my-secret-key"

# ❌ 危险 - 在代码中打印密钥
print(f"API Key: {api_key}")

# ❌ 危险 - 提交到版本控制
# config.py
DATABASE_URL = "postgresql://user:password@localhost/db"
```

### ✅ 正确做法

```python
# ✅ 使用环境变量
import os
from pathlib import Path

API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise ValueError("API_KEY environment variable is required")

# ✅ 带默认值的安全默认值
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# ✅ 从配置文件读取（配置文件在 .gitignore 中）
from pathlib import Path
import json

config_path = Path(__file__).parent / "config.json"
if config_path.exists():
    config = json.loads(config_path.read_text())
    API_KEY = config.get("api_key")
```

### .env 文件模式

```bash
# .env.example（提交到版本控制）
API_KEY=
DATABASE_URL=
SECRET_KEY=

# .env（不提交）
API_KEY=sk-xxx
DATABASE_URL=postgresql://...
SECRET_KEY=xxx
```

```python
# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv()  # 在应用启动时调用

import os
API_KEY = os.environ["API_KEY"]
```

### .gitignore 配置

```gitignore
# 环境配置
.env
.env.local
.env.*.local

# 密钥文件
*.pem
*.key
credentials.json
secrets.json

# 数据库
*.db
*.sqlite
*.sqlite3

# 日志
*.log
```

---

## 输入验证

### SQL 注入防护

```python
# ✅ 参数化查询（安全）
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))

# ❌ 字符串拼接（危险）
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# ✅ ORM（安全）
user = User.query.filter_by(id=user_id).first()

# ❌ SQL 字符串（危险）
query = f"SELECT * FROM users WHERE name = '{name}'"
```

### 输入清理

```python
import re
from html import escape

def sanitize_html(user_input: str) -> str:
    """Remove dangerous HTML tags."""
    # 方案一：转义
    safe_text = escape(user_input)
    
    # 方案二：使用 bleach 库
    # pip install bleach
    # import bleach
    # safe_text = bleach.clean(user_input, tags=[], strip=True)
    
    return safe_text

def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_username(username: str) -> bool:
    """Validate username format."""
    if len(username) < 3 or len(username) > 32:
        return False
    return bool(re.match(r'^[a-zA-Z0-9_-]+$', username))
```

### 路径遍历防护

```python
from pathlib import Path

def safe_read_file(base_dir: str, filename: str) -> str:
    """Safely read a file within base directory."""
    base = Path(base_dir).resolve()
    target = (base / filename).resolve()
    
    # 确保目标路径在 base 目录内
    if not target.is_relative_to(base):
        raise ValueError("Access denied: path traversal detected")
    
    return target.read_text()

# ✅ 使用
content = safe_read_file("/var/www/uploads", "../../etc/passwd")  # 拒绝！
```

---

## 密码处理

### ❌ 错误做法

```python
# ❌ 明文存储
def save_password(user_id, password):
    db.execute(f"UPDATE users SET password='{password}' WHERE id={user_id}")

# ❌ MD5/SHA1（不安全）
import hashlib
hashed = hashlib.md5(password.encode()).hexdigest()

# ❌ 可逆加密
encrypted = some_decrypt(password)  # 密码可被还原
```

### ✅ 正确做法

```python
import bcrypt
import hashlib

# bcrypt（推荐）
def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

def verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode(), hashed)

# Argon2（更推荐，但需要额外安装）
# pip install argon2-cffi
from argon2 import PasswordHasher

ph = PasswordHasher()
hash = ph.hash("s3cr3t")
assert ph.verify(hash, "s3cr3t")
```

---

## 加密与签名

### 使用 cryptography 库

```bash
pip install cryptography
```

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import base64

# 生成密钥
def generate_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

# 加密
def encrypt(data: str, key: bytes) -> bytes:
    f = Fernet(key)
    return f.encrypt(data.encode())

# 解密
def decrypt(token: bytes, key: bytes) -> str:
    f = Fernet(key)
    return f.decrypt(token).decode()
```

---

## 依赖安全

### 安全检查

```bash
# pip-audit
pip install pip-audit
pip-audit

# safety
pip install safety
safety check

# pipenv（自动检查）
pipenv check
```

### 依赖配置

```toml
# pyproject.toml
[project]
dependencies = [
    "requests>=2.31.0",  # 指定最低版本
]

[tool.safety]
# 自动运行 pip-audit
```

---

## API 安全

### 认证与授权

```python
import secrets

# ✅ 安全生成令牌
def generate_api_key() -> str:
    return secrets.token_urlsafe(32)

def generate_token() -> str:
    return secrets.token_hex(24)

# ❌ 不安全
import random
import string
token = ''.join(random.choices(string.ascii_letters, k=24))
```

### Rate Limiting

```python
# 使用 flask-limiter 示例
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
)

@app.route("/api/search")
@limiter.limit("10 per minute")
def search():
    ...
```

### CORS 配置

```python
# Flask-CORS 示例
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://trusted-domain.com"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"],
    }
})
```

---

## 错误处理

### ❌ 泄露敏感信息

```python
# ❌ 错误：向用户暴露内部错误
try:
    do_something()
except Exception as e:
    return f"Error: {e}"  # 泄露堆栈和错误详情
```

### ✅ 安全错误处理

```python
import logging
import sys

logger = logging.getLogger(__name__)

def handle_error(e: Exception) -> None:
    """记录错误，返回用户友好的消息。"""
    # 记录完整错误（仅在日志中）
    logger.exception(f"Unexpected error: {e}")
    
    # 返回通用消息
    raise HTTPException(
        status_code=500,
        detail="An internal error occurred. Please try again later."
    )

# 生产环境：确保不回溯输出到客户端
# 配置日志处理器，不要让 traceback 到达客户端
```

---

## 常见漏洞检查清单

### OWASP Top 10 相关

| 漏洞类型 | 防护措施 |
|----------|----------|
| **注入** | 参数化查询、输入验证 |
| **认证失败** | 强密码策略、会话管理 |
| **敏感数据暴露** | 加密、HTTPS、环境变量 |
| **XML 外部实体** | 使用安全的 XML 解析器 |
| **访问控制** | 最小权限原则 |
| **安全配置错误** | 禁用调试模式、安全默认配置 |
| **XSS** | 输出转义、内容安全策略 |
| **不安全的反序列化** | 避免 pickle、使用 JSON |
| **使用有漏洞组件** | 定期更新依赖 |
| **日志不足** | 记录安全事件、监控异常 |

### 基础安全检查

- [ ] 无硬编码密码/密钥
- [ ] 使用参数化查询
- [ ] 用户输入已验证
- [ ] 密码使用 bcrypt/argon2 哈希
- [ ] API 密钥通过环境变量注入
- [ ] 错误信息不泄露敏感信息
- [ ] 依赖定期更新
- [ ] HTTPS 用于生产环境
- [ ] CSRF Token 用于表单
- [ ] Session 管理正确

---

## 相关资源

- [OWASP Python 安全指南](https://cheatsheetseries.owasp.org/cheatsheets/Python_Security_Cheat_Sheet.html)
- [Python 安全文档](https://docs.python.org/3/library/security.html)
- [bandit（Python 安全检查工具）](https://bandit.readthedocs.io/)
