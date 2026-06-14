# 提交前检查

---

## 快速检查命令

```bash
# 语法检查（必须）
python -m py_compile your_file.py

# 运行测试
python -m pytest -v

# 代码格式检查
ruff check . --fix
ruff format .

# 类型检查
mypy src/
```

---

## 完整检查脚本

创建 `scripts/pre-commit-check.sh`:

```bash
#!/bin/bash
# pre-commit-check.sh - Python 代码提交前检查

set -e

echo "🔍 Running Python code checks..."

# 1. 语法检查（必须）
echo "[1/4] Syntax check..."
find . -name "*.py" -not -path "./.venv/*" -not -path "./venv/*" -exec python -m py_compile {} +
echo "✅ Syntax OK"

# 2. 代码格式检查
echo "[2/4] Format check..."
if command -v ruff &>/dev/null; then
    ruff check . --fix
    ruff format .
elif command -v black &>/dev/null; then
    black .
    isort .
else
    echo "⚠️  ruff/black not installed"
fi
echo "✅ Format OK"

# 3. 运行测试
echo "[3/4] Running tests..."
if [ -d "tests" ]; then
    python -m pytest tests/ -v --tb=short 2>/dev/null || \
    python -m unittest discover -v 2>/dev/null || \
    echo "⚠️  No tests found"
else
    echo "⚠️  No tests directory"
fi
echo "✅ Tests OK"

# 4. 类型检查（如果有 mypy 配置）
echo "[4/4] Type check..."
if [ -f "mypy.ini" ] || [ -f "pyproject.toml" ]; then
    if command -v mypy &>/dev/null; then
        mypy src/ 2>/dev/null || echo "⚠️  Type errors found"
    else
        echo "⚠️  mypy not installed"
    fi
else
    echo "⏭️  Skipping (no mypy config)"
fi

echo "🎉 All checks passed!"
```

Windows 批处理版本 `scripts/pre-commit-check.bat`:

```batch
@echo off
echo 🔍 Running Python code checks...

REM 1. 语法检查
echo [1/4] Syntax check...
python -m py_compile **/*.py
if errorlevel 1 exit /b 1
echo ✅ Syntax OK

REM 2. 格式化检查
echo [2/4] Format check...
if exist pyproject.toml (
    ruff check . --fix
    ruff format .
)
echo ✅ Format OK

REM 3. 运行测试
echo [3/4] Running tests...
if exist tests (
    python -m pytest tests/ -v --tb=short
)
echo ✅ Tests OK

echo 🎉 All checks passed!
```

---

## Git Hooks 集成

### pre-commit 配置文件

创建 `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests]
```

安装 hooks:
```bash
pip install pre-commit
pre-commit install
```

---

## CI/CD 检查

### GitHub Actions 示例

创建 `.github/workflows/python-ci.yml`:

```yaml
name: Python CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e .[dev]

      - name: Lint with ruff
        run: |
          ruff check .
          ruff format --check .

      - name: Type check with mypy
        run: mypy src/

      - name: Test with pytest
        run: pytest --cov=src --cov-report=xml
```

---

## 常用工具命令速查

| 工具 | 安装 | 检查命令 | 自动修复 |
|------|------|----------|----------|
| ruff | `pip install ruff` | `ruff check .` | `ruff check --fix .` |
| black | `pip install black` | `black --check .` | `black .` |
| isort | `pip install isort` | `isort --check .` | `isort .` |
| mypy | `pip install mypy` | `mypy src/` | - |
| pyright | `npm i -g pyright` | `pyright src/` | - |
| pytest | `pip install pytest` | `pytest -v` | - |
