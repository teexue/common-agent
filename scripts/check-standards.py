#!/usr/bin/env python3
"""代码规范检查脚本

用法:
    python3 scripts/check-standards.py          # 完整检查（含构建和测试）
    python3 scripts/check-standards.py --quick   # 仅检查规范，跳过构建和测试
    python3 scripts/check-standards.py --hook    # pre-commit hook 模式（仅检查 staged 文件）
"""

import glob
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


@dataclass
class CheckResult:
    name: str
    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ─── 文件收集 ──────────────────────────────────────────────────

def get_go_files(hook_mode: bool = False) -> list[Path]:
    if hook_mode:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        files = []
        for f in result.stdout.strip().split("\n"):
            if f.endswith(".go") and "_test.go" not in f and "vendor/" not in f and "proto/" not in f and "node_modules/" not in f:
                files.append(PROJECT_ROOT / f)
        return files
    return sorted(
        p for p in PROJECT_ROOT.rglob("*.go")
        if "_test.go" not in p.name
        and "vendor" not in p.parts
        and "proto" not in p.parts
        and "node_modules" not in p.parts
    )


def get_frontend_files(hook_mode: bool = False) -> list[Path]:
    if hook_mode:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        files = []
        for f in result.stdout.strip().split("\n"):
            if (f.endswith(".ts") or f.endswith(".tsx")) and ".test." not in f and "node_modules/" not in f:
                files.append(PROJECT_ROOT / f)
        return files
    return sorted(
        p for p in (PROJECT_ROOT / "frontend" / "src").rglob("*")
        if p.suffix in (".ts", ".tsx") and ".test." not in p.name and "node_modules" not in p.parts
    )


# ─── Go 规范检查 ──────────────────────────────────────────────────

def check_go_function_length(files: list[Path]) -> CheckResult:
    """Go 函数长度 ≤ 80 行"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        depth = 0
        func_start = None
        func_name = None
        for i, line in enumerate(lines):
            m = re.match(r'^func\s+(?:\([^)]+\)\s+)?(\w+)', line)
            if m and '{' in line:
                func_start = i
                func_name = m.group(1)
                depth = line.count('{') - line.count('}')
            elif func_start is not None:
                depth += line.count('{') - line.count('}')
                if depth <= 0:
                    length = i - func_start + 1
                    if length > 80:
                        violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {func_name}() = {length} lines")
                    func_start = None
    return CheckResult("Go 函数长度检查（≤ 80 行）", len(violations) == 0, violations)


def check_go_parameters(files: list[Path]) -> CheckResult:
    """Go 函数参数 ≤ 5 个"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for i, line in enumerate(lines):
            m = re.match(r'^func\s+(?:\([^)]+\)\s+)?(\w+)\(([^)]+)\)', line)
            if m:
                params = [p.strip() for p in m.group(2).split(',') if p.strip()]
                if len(params) > 5:
                    violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {m.group(1)}() = {len(params)} params")
    return CheckResult("Go 函数参数检查（≤ 5 个）", len(violations) == 0, violations)


def check_go_file_length(files: list[Path]) -> CheckResult:
    """Go 文件长度 ≤ 500 行"""
    violations = []
    for f in files:
        count = len(f.read_text().splitlines())
        if count > 500:
            violations.append(f"  {f.relative_to(PROJECT_ROOT)}: {count} lines")
    return CheckResult("Go 文件长度检查（≤ 500 行）", len(violations) == 0, violations)


def check_go_doc_comments(files: list[Path]) -> CheckResult:
    """Go 导出符号必须有 doc comment"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for i, line in enumerate(lines):
            if re.match(r'^(func|type|var|const)\s+[A-Z]', line.strip()):
                if i > 0 and not lines[i - 1].strip().startswith('//'):
                    violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {line.strip()[:50]}")
    return CheckResult("Go doc comment 检查", len(violations) == 0, violations)


# ─── 前端规范检查 ──────────────────────────────────────────────────

def check_frontend_function_length(files: list[Path]) -> CheckResult:
    """前端函数/组件长度 ≤ 60 行"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for i, line in enumerate(lines):
            stripped = line.strip()
            if re.match(r'^(export\s+)?function\s+\w+', stripped) or \
               re.match(r'^(export\s+)?const\s+\w+\s*=\s*(\(|async)', stripped):
                depth = 0
                started = False
                for j in range(i, min(i + 600, len(lines))):
                    depth += lines[j].count('{') - lines[j].count('}')
                    if '{' in lines[j]:
                        started = True
                    if started and depth <= 0:
                        length = j - i + 1
                        name = re.match(r'^(?:export\s+)?(?:function|const)\s+(\w+)', stripped)
                        if name and length > 60:
                            violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {name.group(1)} = {length} lines")
                        break
    return CheckResult("前端函数长度检查（≤ 60 行）", len(violations) == 0, violations)


def check_frontend_any_types(files: list[Path]) -> CheckResult:
    """前端禁止 any 类型"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for i, line in enumerate(lines):
            if re.search(r':\s*any\b|as\s+any\b|<any>', line):
                violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {line.strip()[:60]}")
    return CheckResult("前端 any 类型检查", len(violations) == 0, violations)


def check_frontend_class_components(files: list[Path]) -> CheckResult:
    """前端禁止 class 组件"""
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for i, line in enumerate(lines):
            if re.search(r'class\s+\w+\s+extends\s+(Component|PureComponent)', line):
                violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i+1} {line.strip()[:60]}")
    return CheckResult("前端 class 组件检查", len(violations) == 0, violations)


# ─── 构建和测试 ──────────────────────────────────────────────────

def run_command(cmd: list[str], cwd: Path = PROJECT_ROOT) -> tuple[bool, str]:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return result.returncode == 0, result.stdout + result.stderr


def check_go_build() -> CheckResult:
    ok, output = run_command(["go", "build", "./..."])
    return CheckResult("Go 构建检查", ok, [] if ok else [f"  {output.strip()[:200]}"])


def check_go_tests() -> CheckResult:
    ok, output = run_command(["go", "test", "./..."])
    violations = []
    if not ok:
        for line in output.splitlines():
            if "FAIL" in line:
                violations.append(f"  {line}")
    return CheckResult("Go 测试检查", ok, violations)


def check_frontend_build() -> CheckResult:
    ok, output = run_command(["pnpm", "run", "build"], cwd=PROJECT_ROOT / "frontend")
    violations = []
    if not ok:
        violations.append(f"  {output.strip()[:200]}")
    return CheckResult("前端构建检查", ok, violations)


def check_frontend_tests() -> CheckResult:
    ok, output = run_command(["pnpm", "test"], cwd=PROJECT_ROOT / "frontend")
    return CheckResult("前端测试检查", ok, [] if ok else [f"  {output.strip()[:200]}"])


# ─── 主流程 ──────────────────────────────────────────────────

def print_result(result: CheckResult):
    if result.passed:
        print(f"\033[32m✓ {result.name}\033[0m")
    else:
        print(f"\033[31m✗ {result.name}\033[0m")
        for err in result.errors:
            print(err)


def main():
    hook_mode = "--hook" in sys.argv
    quick_mode = "--quick" in sys.argv

    print("━━━ 代码规范检查 ━━━")
    print(f"项目: {PROJECT_ROOT}")
    mode = "pre-commit hook" if hook_mode else ("快速检查" if quick_mode else "完整检查")
    print(f"模式: {mode}")
    print()

    # 收集文件
    go_files = get_go_files(hook_mode)
    fe_files = get_frontend_files(hook_mode)

    # 执行检查
    results: list[CheckResult] = []

    # Go 规范
    results.append(check_go_function_length(go_files))
    results.append(check_go_parameters(go_files))
    results.append(check_go_file_length(go_files))
    results.append(check_go_doc_comments(go_files))

    # 前端规范
    results.append(check_frontend_function_length(fe_files))
    results.append(check_frontend_any_types(fe_files))
    results.append(check_frontend_class_components(fe_files))

    # 构建和测试（非 hook 模式且非 quick 模式）
    if not hook_mode and not quick_mode:
        results.append(check_go_build())
        results.append(check_go_tests())
        results.append(check_frontend_build())
        results.append(check_frontend_tests())

    # 输出结果
    print("━━━ 检查结果 ━━━")
    for r in results:
        print_result(r)

    # 汇总
    errors = sum(1 for r in results if not r.passed)
    print()
    if errors > 0:
        print(f"\033[31m✗ {errors} 个检查未通过\033[0m")
        sys.exit(1)
    else:
        print("\033[32m✓ 所有检查通过\033[0m")
        sys.exit(0)


if __name__ == "__main__":
    main()
