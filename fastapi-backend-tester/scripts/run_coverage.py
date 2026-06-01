#!/usr/bin/env python3
"""
FastAPI 测试覆盖率分析器

运行 pytest 覆盖率检查并输出结构化的未覆盖模块报告，
帮助定位需要补充测试的代码区域。

用法:
    python run_coverage.py <项目目录> [--package app] [--threshold 80] [--html]

示例:
    python run_coverage.py ./my_fastapi_app
    python run_coverage.py ./my_fastapi_app --package app --threshold 90 --html
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple


def parse_args():
    parser = argparse.ArgumentParser(description="FastAPI 测试覆盖率分析器")
    parser.add_argument("project_dir", help="FastAPI 项目根目录")
    parser.add_argument("--package", default="app", help="要检查覆盖率的包名 (默认: app)")
    parser.add_argument("--threshold", type=int, default=80, help="覆盖率阈值百分比 (默认: 80)")
    parser.add_argument("--html", action="store_true", help="生成 HTML 覆盖率报告")
    parser.add_argument("--json", dest="json_output", action="store_true", help="输出 JSON 格式报告")
    return parser.parse_args()


def check_pytest_available() -> str:
    """检查 pytest 是否可用"""
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return "python -m pytest"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    try:
        result = subprocess.run(
            ["pytest", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return "pytest"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    return ""


def check_coverage_available() -> bool:
    """检查 pytest-cov 是否可用"""
    try:
        result = subprocess.run(
            ["python", "-c", "import pytest_cov"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def run_coverage(project_dir: str, package: str, html: bool = False) -> Tuple[int, str, str]:
    """运行覆盖率检查"""
    cmd = [
        sys.executable, "-m", "pytest",
        f"--cov={package}",
        "--cov-report=term-missing",
    ]
    if html:
        cmd.append("--cov-report=html")
    cmd.extend(["--tb=short", "-q"])
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=project_dir,
        timeout=300,
    )
    return result.returncode, result.stdout, result.stderr


def parse_coverage_output(stdout: str) -> List[Dict]:
    """解析覆盖率输出，提取模块信息"""
    modules = []
    # 匹配覆盖率报告行：Module    Statements    Missing    Covered
    pattern = re.compile(
        r'^(\S+)\s+'           # 模块名
        r'(\d+)\s+'            # 语句数
        r'(\d+)\s+'            # 缺失数
        r'(\d+)%'              # 覆盖率
    )
    
    for line in stdout.split("\n"):
        match = pattern.match(line.strip())
        if match:
            module_name = match.group(1)
            statements = int(match.group(2))
            missing = int(match.group(3))
            coverage = int(match.group(4))
            
            # 提取缺失行号（如果有）
            missing_lines = ""
            lines_match = re.search(r'\d+%\s+(.*)', line.strip())
            if lines_match:
                missing_lines = lines_match.group(1).strip()
            
            modules.append({
                "module": module_name,
                "statements": statements,
                "missing": missing,
                "coverage_pct": coverage,
                "missing_lines": missing_lines,
            })
    
    return modules


def generate_report(modules: List[Dict], threshold: int, json_output: bool = False) -> str:
    """生成覆盖率报告"""
    if not modules:
        return "⚠️ 未解析到覆盖率数据，请确认 pytest-cov 已安装且项目可测试"
    
    # 按覆盖率排序（低的在前）
    sorted_modules = sorted(modules, key=lambda x: x["coverage_pct"])
    
    below_threshold = [m for m in sorted_modules if m["coverage_pct"] < threshold]
    above_threshold = [m for m in sorted_modules if m["coverage_pct"] >= threshold]
    
    total_statements = sum(m["statements"] for m in modules)
    total_missing = sum(m["missing"] for m in modules)
    total_coverage = round((total_statements - total_missing) / total_statements * 100, 1) if total_statements > 0 else 0
    
    if json_output:
        report = {
            "total_coverage": total_coverage,
            "threshold": threshold,
            "total_modules": len(modules),
            "below_threshold": len(below_threshold),
            "above_threshold": len(above_threshold),
            "modules": sorted_modules,
        }
        return json.dumps(report, indent=2, ensure_ascii=False)
    
    # 文本报告
    lines = []
    lines.append("=" * 70)
    lines.append("📊 FastAPI 测试覆盖率报告")
    lines.append("=" * 70)
    lines.append(f"")
    lines.append(f"整体覆盖率: {total_coverage}%  (阈值: {threshold}%)")
    lines.append(f"模块总数: {len(modules)}  |  低于阈值: {len(below_threshold)}  |  达标: {len(above_threshold)}")
    lines.append(f"")
    
    if below_threshold:
        lines.append("🔴 低于阈值的模块（需优先补充测试）:")
        lines.append("-" * 70)
        for m in below_threshold:
            lines.append(f"  {m['module']:<40s} {m['coverage_pct']:>3d}%  (缺 {m['missing']} 行)")
            if m["missing_lines"]:
                lines.append(f"    缺失行: {m['missing_lines']}")
        lines.append("")
    
    if above_threshold:
        lines.append("🟢 达标的模块:")
        lines.append("-" * 70)
        for m in above_threshold:
            lines.append(f"  {m['module']:<40s} {m['coverage_pct']:>3d}%")
        lines.append("")
    
    # 改进建议
    if below_threshold:
        lines.append("💡 改进建议:")
        for m in below_threshold[:5]:  # 最多列5个
            lines.append(f"  - 为 {m['module']} 补充测试，重点关注缺失的 {m['missing']} 行代码")
    
    lines.append("=" * 70)
    
    return "\n".join(lines)


def main():
    args = parse_args()
    project_dir = os.path.abspath(args.project_dir)
    
    if not os.path.isdir(project_dir):
        print(f"错误: 目录不存在 - {project_dir}")
        sys.exit(1)
    
    print(f"🔍 分析覆盖率: {project_dir}")
    print(f"   包名: {args.package}")
    print(f"   阈值: {args.threshold}%")
    print()
    
    # 检查依赖
    pytest_cmd = check_pytest_available()
    if not pytest_cmd:
        print("❌ 未找到 pytest，请安装: pip install pytest pytest-cov")
        sys.exit(1)
    
    if not check_coverage_available():
        print("❌ 未找到 pytest-cov，请安装: pip install pytest-cov")
        sys.exit(1)
    
    # 运行覆盖率检查
    print("⏳ 运行覆盖率检查...")
    returncode, stdout, stderr = run_coverage(project_dir, args.package, args.html)
    
    # 解析输出
    modules = parse_coverage_output(stdout)
    
    # 生成报告
    report = generate_report(modules, args.threshold, args.json_output)
    print(report)
    
    if args.html:
        html_path = os.path.join(project_dir, "htmlcov", "index.html")
        print(f"\n📄 HTML 报告已生成: {html_path}")
    
    # 返回退出码
    total_statements = sum(m["statements"] for m in modules)
    total_missing = sum(m["missing"] for m in modules)
    total_coverage = round((total_statements - total_missing) / total_statements * 100, 1) if total_statements > 0 else 0
    
    if total_coverage < args.threshold:
        print(f"\n⚠️ 整体覆盖率 {total_coverage}% 低于阈值 {args.threshold}%")
        sys.exit(1)
    else:
        print(f"\n✅ 整体覆盖率 {total_coverage}% 达到阈值 {args.threshold}%")
        sys.exit(0)


if __name__ == "__main__":
    main()
