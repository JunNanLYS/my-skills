# Python 版本与依赖管理

---

## Python 版本要求

### 版本策略

| 级别 | 版本 | 说明 |
|------|------|------|
| **最低要求** | Python 3.10 | 3.9 已于 2025 年 10 月 EOL |
| **推荐版本** | Python 3.11-3.13 | 新项目首选，享受性能提升 |
| **特性版本** | Python 3.12+ | 支持 `match` 语句、结构化模式匹配 |

### 版本检查

```python
# 脚本开头检查
import sys

if sys.version_info < (3, 10):
    raise SystemExit("Python 3.10+ required")
```

### pyproject.toml 配置

```toml
[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.10"

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1.0",
    "mypy>=1.0",
]
```

---

## uv（推荐）

### 安装 uv

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 或通过 pip
pip install uv
```

### 创建项目

```bash
# 初始化新项目
uv init myproject
cd myproject

# 创建虚拟环境
uv venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
```

### 依赖管理

```bash
# 添加依赖
uv add requests
uv add "requests>=2.28"
uv add --dev pytest black

# 编译锁文件
uv pip compile requirements.in -o requirements.txt

# 从锁文件安装
uv pip sync requirements.txt

# 移除依赖
uv remove requests

# 更新所有依赖
uv pip compile --generate-hashes requirements.in -o requirements.txt
```

### requirements.in 示例

```
# requirements.in
requests>=2.28.0
pydantic>=2.0
```

---

## pip（备用）

### 基础命令

```bash
# 安装
pip install requests
pip install -r requirements.txt

# 冻结锁定
pip freeze > requirements.lock

# 升级
pip install --upgrade requests
pip install -r requirements.lock --upgrade

# 卸载
pip uninstall requests
```

### requirements.txt 示例

```
# requirements.txt（锁定版本）
requests==2.31.0
pydantic==2.5.0
```

---

## 虚拟环境管理

### venv 内置

```bash
# 创建
python -m venv .venv

# 激活
source .venv/bin/activate      # Linux/Mac
.venv\Scripts\activate        # Windows

# 停用
deactivate
```

### 常见环境变量

```bash
# 指定 Python 版本（pyenv）
pyenv install 3.11.7
pyenv local 3.11.7

# pip 指定源
pip install requests -i https://pypi.tuna.tsinghua.edu.cn/simple

# 永久设置 pip 源
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 多环境切换

### pyenv + venv

```bash
# 安装指定版本
pyenv install 3.11.7
pyenv install 3.12.1

# 设置项目版本
pyenv local 3.11.7
python -m venv .venv
```

### conda

```bash
# 创建环境
conda create -n myenv python=3.11

# 激活
conda activate myenv

# 安装依赖
conda install requests
conda env export > environment.yml
```

---

## 依赖管理最佳实践

### 目录结构

```
project/
├── src/              # 源代码
├── tests/            # 测试
├── pyproject.toml    # 项目配置
├── uv.lock          # 锁文件（uv）
├── requirements.in   # 依赖源文件
└── requirements.txt  # 锁定依赖
```

### 安全检查

```bash
# pip-audit
pip install pip-audit
pip-audit

# safety
pip install safety
safety check

# 漏洞扫描
pip install piprev
piprev
```

### 依赖冲突检测

```bash
# pip check
pip install pipdeptree
pipdeptree
pip check
```
