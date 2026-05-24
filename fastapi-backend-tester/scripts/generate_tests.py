#!/usr/bin/env python3
"""
FastAPI 测试骨架生成器

分析 FastAPI 项目路由结构，自动生成 pytest 测试骨架代码。
支持同步 TestClient 和异步 httpx.AsyncClient 两种模式。

用法:
    python generate_tests.py <项目目录> [--output tests/] [--async] [--verbose]

示例:
    python generate_tests.py ./my_fastapi_app
    python generate_tests.py ./my_fastapi_app --output tests/ --async
"""

import argparse
import ast
import importlib.util
import inspect
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def parse_args():
    parser = argparse.ArgumentParser(description="FastAPI 测试骨架生成器")
    parser.add_argument("project_dir", help="FastAPI 项目根目录")
    parser.add_argument("--output", default="tests", help="测试输出目录 (默认: tests/)")
    parser.add_argument("--async", dest="use_async", action="store_true", help="使用异步 httpx.AsyncClient 模式")
    parser.add_argument("--verbose", action="store_true", help="详细输出")
    return parser.parse_args()


def find_fastapi_app(project_dir: str) -> List[Tuple[str, str]]:
    """扫描项目目录，找到所有 FastAPI 应用实例"""
    apps = []
    for root, _, files in os.walk(project_dir):
        # 跳过 venv、__pycache__、.git 等目录
        skip_dirs = {"venv", ".venv", "__pycache__", ".git", "node_modules", ".env"}
        if any(skip in root for skip in skip_dirs):
            continue
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        tree = ast.parse(f.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Assign):
                            for target in node.targets:
                                if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                                    call = node.value
                                    if isinstance(call.func, ast.Name) and call.func.id == "FastAPI":
                                        apps.append((fpath, target.id))
                                    elif isinstance(call.func, ast.Attribute) and call.func.attr == "FastAPI":
                                        apps.append((fpath, target.id))
                except (SyntaxError, UnicodeDecodeError):
                    continue
    return apps


def find_routers(project_dir: str) -> List[Tuple[str, str, str]]:
    """扫描项目目录，找到所有 APIRouter 实例及其路由"""
    routers = []
    for root, _, files in os.walk(project_dir):
        skip_dirs = {"venv", ".venv", "__pycache__", ".git", "node_modules", ".env"}
        if any(skip in root for skip in skip_dirs):
            continue
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    tree = ast.parse(content)
                    
                    router_name = None
                    router_prefix = ""
                    routes = []
                    
                    for node in ast.walk(tree):
                        # 找到 APIRouter 定义
                        if isinstance(node, ast.Assign):
                            for target in node.targets:
                                if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                                    call = node.value
                                    if isinstance(call.func, ast.Name) and call.func.id == "APIRouter":
                                        router_name = target.id
                                        # 提取 prefix 参数
                                        for kw in call.keywords:
                                            if kw.arg == "prefix":
                                                if isinstance(kw.value, ast.Constant):
                                                    router_prefix = kw.value.value
                        
                        # 找到路由装饰器
                        if isinstance(node, ast.AsyncFunctionDef) or isinstance(node, ast.FunctionDef):
                            for decorator in node.decorator_list:
                                method = None
                                path = None
                                if isinstance(decorator, ast.Call):
                                    if isinstance(decorator.func, ast.Attribute):
                                        method = decorator.func.attr
                                        for arg in decorator.args:
                                            if isinstance(arg, ast.Constant):
                                                path = arg.value
                                        for kw in decorator.keywords:
                                            if kw.arg in (None, "path") and isinstance(kw.value, ast.Constant):
                                                path = kw.value.value
                                elif isinstance(decorator, ast.Attribute):
                                    method = decorator.func.attr
                                
                                if method in ("get", "post", "put", "delete", "patch"):
                                    func_name = node.name
                                    routes.append({
                                        "method": method.upper(),
                                        "path": path or "/",
                                        "func_name": func_name,
                                        "router_name": router_name,
                                        "prefix": router_prefix,
                                    })
                    
                    if routes:
                        routers.append((fpath, router_name or "unknown", routes))
                        
                except (SyntaxError, UnicodeDecodeError):
                    continue
    return routers


def generate_test_for_route(route: Dict, use_async: bool = False) -> str:
    """为单个路由生成测试代码"""
    method = route["method"]
    path = route["path"]
    full_path = route.get("prefix", "") + path
    func_name = route["func_name"]
    
    # 将路径参数中的 {param} 替换为示例值
    test_path = full_path
    path_params = []
    while "{" in test_path:
        start = test_path.index("{")
        end = test_path.index("}")
        param_name = test_path[start+1:end]
        path_params.append(param_name)
        test_path = test_path[:start] + f"example_{param_name}" + test_path[end+1:]
    
    test_func_name = f"test_{func_name}_{method.lower()}"
    
    if use_async:
        template = f'''
@pytest.mark.asyncio
async def {test_func_name}(auth_client):
    """{method} {full_path} - 正常请求"""
    response = await auth_client.{method.lower()}("{test_path}")
    assert response.status_code in (200, 201, 204)

@pytest.mark.asyncio
async def {test_func_name}_unauthorized(async_client):
    """{method} {full_path} - 未认证请求"""
    response = await async_client.{method.lower()}("{test_path}")
    assert response.status_code in (401, 403)

@pytest.mark.asyncio
async def {test_func_name}_validation(auth_client):
    """{method} {full_path} - 参数校验失败"""
    response = await auth_client.{method.lower()}("{test_path}", json={{}})
    assert response.status_code == 422
'''
    else:
        template = f'''
def {test_func_name}(auth_client):
    """{method} {full_path} - 正常请求"""
    response = auth_client.{method.lower()}("{test_path}")
    assert response.status_code in (200, 201, 204)

def {test_func_name}_unauthorized(client):
    """{method} {full_path} - 未认证请求"""
    response = client.{method.lower()}("{test_path}")
    assert response.status_code in (401, 403)

def {test_func_name}_validation(auth_client):
    """{method} {full_path} - 参数校验失败"""
    response = auth_client.{method.lower()}("{test_path}", json={{}})
    assert response.status_code == 422
'''
    return template


def generate_conftest(app_import_path: str, app_var_name: str, use_async: bool = False) -> str:
    """生成 conftest.py"""
    if use_async:
        return f'''import pytest
from httpx import AsyncClient, ASGITransport
from {app_import_path} import {app_var_name}


@pytest.fixture
async def async_client():
    """未认证的异步测试客户端"""
    transport = ASGITransport(app={app_var_name})
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def auth_client(async_client):
    """已认证的异步测试客户端 - 根据项目认证方式修改"""
    # TODO: 根据实际认证方式获取 token
    # token = await get_test_token()
    # async_client.headers.update({{"Authorization": f"Bearer {{token}}"}})
    return async_client
'''
    else:
        return f'''import pytest
from fastapi.testclient import TestClient
from {app_import_path} import {app_var_name}


@pytest.fixture
def client():
    """未认证的测试客户端"""
    return TestClient({app_var_name})


@pytest.fixture
def auth_client(client):
    """已认证的测试客户端 - 根据项目认证方式修改"""
    # TODO: 根据实际认证方式获取 token
    # response = client.post("/auth/login", json={{...}})
    # token = response.json()["access_token"]
    # client.headers.update({{"Authorization": f"Bearer {{token}}"}})
    return client
'''


def get_app_import_path(fpath: str, project_dir: str) -> str:
    """从文件路径推导 Python 导入路径"""
    rel_path = os.path.relpath(fpath, project_dir)
    module_path = rel_path.replace(os.sep, ".").replace(".py", "")
    # 如果在子目录中，保留完整路径
    return module_path


def main():
    args = parse_args()
    project_dir = os.path.abspath(args.project_dir)
    output_dir = os.path.join(project_dir, args.output)
    use_async = args.use_async
    
    if not os.path.isdir(project_dir):
        print(f"错误: 目录不存在 - {project_dir}")
        sys.exit(1)
    
    print(f"🔍 扫描项目: {project_dir}")
    
    # 查找 FastAPI 应用
    apps = find_fastapi_app(project_dir)
    if not apps:
        print("⚠️ 未找到 FastAPI 应用实例，请确认项目结构")
        sys.exit(1)
    
    print(f"✅ 找到 {len(apps)} 个 FastAPI 应用:")
    for fpath, app_name in apps:
        print(f"   - {app_name} @ {os.path.relpath(fpath, project_dir)}")
    
    # 查找路由
    routers = find_routers(project_dir)
    total_routes = sum(len(r[2]) for r in routers)
    print(f"✅ 找到 {len(routers)} 个路由模块，共 {total_routes} 个路由")
    
    if args.verbose:
        for fpath, router_name, routes in routers:
            print(f"\n  📂 {os.path.relpath(fpath, project_dir)} ({router_name}):")
            for route in routes:
                print(f"     {route['method']:6s} {route.get('prefix', '')}{route['path']}")
    
    # 创建输出目录
    test_api_dir = os.path.join(output_dir, "test_api")
    os.makedirs(test_api_dir, exist_ok=True)
    
    # 生成 __init__.py
    for d in [output_dir, test_api_dir]:
        init_file = os.path.join(d, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, "w", encoding="utf-8") as f:
                f.write("")
    
    # 生成 conftest.py
    main_app_path, main_app_name = apps[0]
    app_import = get_app_import_path(main_app_path, project_dir)
    conftest_content = generate_conftest(app_import, main_app_name, use_async)
    conftest_path = os.path.join(output_dir, "conftest.py")
    with open(conftest_path, "w", encoding="utf-8") as f:
        f.write(conftest_content)
    print(f"\n📝 生成 conftest.py: {os.path.relpath(conftest_path, project_dir)}")
    
    # 按路由模块生成测试文件
    generated_count = 0
    for fpath, router_name, routes in routers:
        if not routes:
            continue
        
        # 按路由模块文件名生成对应测试文件名
        module_name = os.path.basename(fpath).replace(".py", "")
        if module_name in ("main", "__init__", "app"):
            # 主应用的路由按功能分组
            test_file_name = "test_main_routes.py"
        else:
            test_file_name = f"test_{module_name}.py"
        
        test_file_path = os.path.join(test_api_dir, test_file_name)
        
        # 生成导入头
        if use_async:
            header = '"""自动生成的 FastAPI 测试 - 异步模式"""\nimport pytest\n'
        else:
            header = '"""自动生成的 FastAPI 测试 - 同步模式"""\nimport pytest\n'
        
        # 生成每个路由的测试
        test_content = header
        for route in routes:
            test_content += generate_test_for_route(route, use_async)
        
        with open(test_file_path, "w", encoding="utf-8") as f:
            f.write(test_content)
        
        generated_count += 1
        print(f"📝 生成测试文件: {os.path.relpath(test_file_path, project_dir)} ({len(routes)} 个路由)")
    
    print(f"\n✅ 完成! 共生成 {generated_count} 个测试文件")
    print(f"📂 测试目录: {os.path.relpath(output_dir, project_dir)}")
    print(f"\n💡 下一步:")
    print(f"   1. 修改 conftest.py 中的认证逻辑")
    print(f"   2. 补充每个测试用例的请求体和断言")
    print(f"   3. 运行: pytest {os.path.relpath(output_dir, project_dir)}/ -v")


if __name__ == "__main__":
    main()
