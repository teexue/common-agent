#!/usr/bin/env python3
"""代码规范检查。规则与 docs/standards.html 第 2、6 节一致。"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

GO_FUNC_MAX = 80
GO_PROD_FILE_MAX = 500
GO_TEST_FILE_MAX = 600
GO_PARAM_MAX = 5
FE_FUNC_MAX = 60
FE_PROD_FILE_MAX = 400
FE_TEST_FILE_MAX = 600
FE_PARAM_MAX = 5


@dataclass
class CheckResult:
    name: str
    passed: bool
    errors: list[str] = field(default_factory=list)


def is_excluded_dir(path: Path) -> bool:
    return any(part in {"vendor", "proto", "node_modules"} for part in path.parts)


def is_ui_file(path: Path) -> bool:
    parts = path.parts
    for i, part in enumerate(parts):
        if part == "components" and i + 1 < len(parts) and parts[i + 1] == "ui":
            return True
    return False


def staged_paths() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    return [f for f in result.stdout.splitlines() if f]


def collect_go_files(hook_mode: bool, tests: bool) -> list[Path]:
    files: list[Path] = []
    if hook_mode:
        for rel in staged_paths():
            if not rel.endswith(".go") or is_excluded_dir(Path(rel)):
                continue
            is_test = rel.endswith("_test.go")
            if tests == is_test:
                files.append(PROJECT_ROOT / rel)
        return files
    for p in PROJECT_ROOT.rglob("*.go"):
        if is_excluded_dir(p):
            continue
        is_test = p.name.endswith("_test.go")
        if tests == is_test:
            files.append(p)
    return sorted(files)


def collect_frontend_files(hook_mode: bool, *, tests: bool, include_ui: bool) -> list[Path]:
    files: list[Path] = []
    src = PROJECT_ROOT / "frontend" / "src"
    if hook_mode:
        for rel in staged_paths():
            if not (rel.endswith(".ts") or rel.endswith(".tsx")):
                continue
            p = PROJECT_ROOT / rel
            is_test = ".test." in Path(rel).name
            if tests != is_test:
                continue
            if not include_ui and is_ui_file(p):
                continue
            if "node_modules" in Path(rel).parts:
                continue
            files.append(p)
        return files
    if not src.exists():
        return []
    for p in src.rglob("*"):
        if p.suffix not in {".ts", ".tsx"}:
            continue
        if "node_modules" in p.parts:
            continue
        is_test = ".test." in p.name
        if tests != is_test:
            continue
        if not include_ui and is_ui_file(p):
            continue
        files.append(p)
    return sorted(files)


def strip_go_line_comment(line: str) -> str:
    in_str = False
    in_char = False
    raw = False
    i = 0
    out = []
    while i < len(line):
        c = line[i]
        if raw:
            out.append(c)
            if c == "`":
                raw = False
            i += 1
            continue
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < len(line):
                out.append(line[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if in_char:
            out.append(c)
            if c == "\\" and i + 1 < len(line):
                out.append(line[i + 1])
                i += 2
                continue
            if c == "'":
                in_char = False
            i += 1
            continue
        if c == "`":
            raw = True
            out.append(c)
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "'":
            in_char = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < len(line) and line[i + 1] == "/":
            break
        out.append(c)
        i += 1
    return "".join(out)


def join_go_from(lines: list[str], start: int) -> tuple[str, int]:
    """Return source from start until the function body's opening brace, and that line index."""
    buf: list[str] = []
    depth_paren = 0
    depth_brack = 0
    i = start
    while i < len(lines):
        raw = strip_go_line_comment(lines[i])
        buf.append(raw)
        for c in raw:
            if c == "(":
                depth_paren += 1
            elif c == ")":
                depth_paren -= 1
            elif c == "[":
                depth_brack += 1
            elif c == "]":
                depth_brack -= 1
        stripped = raw.strip()
        if depth_paren <= 0 and depth_brack <= 0 and "{" in raw:
            if re.search(r"\bstruct\s*\{", stripped) or re.search(r"\binterface\s*\{", stripped):
                i += 1
                continue
            return "\n".join(buf), i
        i += 1
    return "\n".join(buf), start


def go_func_body_end(lines: list[str], brace_line: int) -> int:
    depth = 0
    started = False
    for i in range(brace_line, len(lines)):
        raw = strip_go_line_comment(lines[i])
        depth += raw.count("{") - raw.count("}")
        if "{" in raw:
            started = True
        if started and depth <= 0:
            return i
    return len(lines) - 1


def parse_go_params(sig: str) -> list[str]:
    """Extract parameter names from a func signature (receiver excluded)."""
    m = re.match(r"^func\s+", sig)
    if not m:
        return []
    rest = sig[m.end() :]
    if rest.startswith("("):
        depth = 0
        for i, c in enumerate(rest):
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    rest = rest[i + 1 :].lstrip()
                    break
    rest = re.sub(r"^\[(?:[^\[\]]|\[[^\]]*\])*\]\s*", "", rest)
    if not rest.startswith("("):
        return []
    depth = 0
    end = None
    for i, c in enumerate(rest):
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        return []
    inner = rest[1:end].strip()
    if not inner:
        return []
    parts: list[str] = []
    buf = ""
    depth = 0
    for c in inner:
        if c in "([{":
            depth += 1
            buf += c
        elif c in ")]}":
            depth -= 1
            buf += c
        elif c == "," and depth == 0:
            if buf.strip():
                parts.append(buf.strip())
            buf = ""
        else:
            buf += c
    if buf.strip():
        parts.append(buf.strip())
    params: list[str] = []
    for p in parts:
        ident = p.strip()
        if ident.startswith("..."):
            ident = ident[3:].strip()
        tokens = ident.split()
        if not tokens:
            continue
        if len(tokens) == 1:
            params.append(tokens[0])
            continue
        names = []
        for tok in tokens[:-1]:
            for piece in tok.split(","):
                piece = piece.strip().rstrip(",")
                if piece and piece != "...":
                    names.append(piece)
        if names:
            params.extend(names)
        else:
            params.append(tokens[0])
    return params


def iter_go_funcs(lines: list[str]) -> list[tuple[str, int, int, int]]:
    """Yield (name, start_line0, end_line0, param_count)."""
    found: list[tuple[str, int, int, int]] = []
    i = 0
    while i < len(lines):
        if not re.match(r"^func\s+", lines[i]):
            i += 1
            continue
        sig, brace_line = join_go_from(lines, i)
        name_m = re.match(
            r"^func\s+(?:\([^)]*\)\s*)?(?:\[(?:[^\[\]]|\[[^\]]*\])*\]\s*)?(\w+)",
            sig.replace("\n", " "),
        )
        name = name_m.group(1) if name_m else "func"
        params = parse_go_params(re.sub(r"\s+", " ", sig))
        end = go_func_body_end(lines, brace_line)
        found.append((name, i, end, len(params)))
        i = end + 1
    return found


def check_go_function_length(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for name, start, end, _ in iter_go_funcs(lines):
            length = end - start + 1
            if length > GO_FUNC_MAX:
                rel = f.relative_to(PROJECT_ROOT)
                violations.append(f"  {rel}:{start + 1} {name}() = {length} lines")
    return CheckResult(f"Go 函数长度检查（≤ {GO_FUNC_MAX} 行）", not violations, violations)


def check_go_parameters(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        lines = f.read_text().splitlines()
        for name, start, _, nparams in iter_go_funcs(lines):
            if nparams > GO_PARAM_MAX:
                rel = f.relative_to(PROJECT_ROOT)
                violations.append(f"  {rel}:{start + 1} {name}() = {nparams} params")
    return CheckResult(f"Go 函数参数检查（≤ {GO_PARAM_MAX} 个）", not violations, violations)


def check_go_file_length(prod: list[Path], tests: list[Path]) -> CheckResult:
    violations = []
    for f in prod:
        count = len(f.read_text().splitlines())
        if count > GO_PROD_FILE_MAX:
            violations.append(f"  {f.relative_to(PROJECT_ROOT)}: {count} lines")
    for f in tests:
        count = len(f.read_text().splitlines())
        if count > GO_TEST_FILE_MAX:
            violations.append(f"  {f.relative_to(PROJECT_ROOT)}: {count} lines (test)")
    return CheckResult(
        f"Go 文件长度检查（生产 ≤ {GO_PROD_FILE_MAX}，测试 ≤ {GO_TEST_FILE_MAX}）",
        not violations,
        violations,
    )


def is_doc_comment(line: str) -> bool:
    s = line.strip()
    return s.startswith("//") or s.startswith("/*")


def check_exported_line(rel: Path, lines: list[str], i: int, text: str, violations: list[str]) -> None:
    if i == 0 or not is_doc_comment(lines[i - 1]):
        violations.append(f"  {rel}:{i + 1} {text.strip()[:50]}")


def check_go_doc_comments(files: list[Path]) -> CheckResult:
    violations: list[str] = []
    ident = re.compile(r"^([A-Z]\w*)\b")
    for f in files:
        lines = f.read_text().splitlines()
        rel = f.relative_to(PROJECT_ROOT)
        in_group = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            if re.match(r"^(const|var|type)\s+\(", stripped):
                in_group = True
                continue
            if in_group:
                if stripped == ")":
                    in_group = False
                    continue
                m = ident.match(stripped)
                if m and not stripped.startswith("//"):
                    check_exported_line(rel, lines, i, stripped, violations)
                continue
            if re.match(r"^(func|type|var|const)\s+[A-Z]", stripped):
                check_exported_line(rel, lines, i, stripped, violations)
    return CheckResult("Go doc comment 检查", not violations, violations)


def skip_ts_string_and_comment(src: str) -> str:
    """Replace strings/comments with spaces so brace counts ignore them."""
    out = []
    i = 0
    n = len(src)
    while i < n:
        if src.startswith("//", i):
            while i < n and src[i] != "\n":
                out.append(" ")
                i += 1
            continue
        if src.startswith("/*", i):
            out.append("  ")
            i += 2
            while i < n and not src.startswith("*/", i):
                out.append("\n" if src[i] == "\n" else " ")
                i += 1
            if i < n:
                out.append("  ")
                i += 2
            continue
        if src[i] in "\"'`":
            q = src[i]
            out.append(" ")
            i += 1
            while i < n:
                if src[i] == "\\" and q != "`":
                    out.append("  ")
                    i += 2
                    continue
                if src[i] == q:
                    out.append(" ")
                    i += 1
                    break
                out.append("\n" if src[i] == "\n" else " ")
                i += 1
            continue
        out.append(src[i])
        i += 1
    return "".join(out)


def matching_brace(src: str, open_idx: int) -> int:
    depth = 0
    for i in range(open_idx, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    return len(src) - 1


def matching_paren(src: str, open_idx: int) -> int:
    depth = 0
    for i in range(open_idx, len(src)):
        if src[i] == "(":
            depth += 1
        elif src[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return len(src) - 1


def count_ts_params(param_src: str) -> int:
    inner = param_src.strip()
    if not inner:
        return 0
    parts: list[str] = []
    buf = ""
    depth = 0
    for c in inner:
        if c in "([{":
            depth += 1
            buf += c
        elif c in ")]}":
            depth -= 1
            buf += c
        elif c == "," and depth == 0:
            if buf.strip():
                parts.append(buf.strip())
            buf = ""
        else:
            buf += c
    if buf.strip():
        parts.append(buf.strip())
    return len(parts)


def line_index(src: str, pos: int) -> int:
    return src[:pos].count("\n")


def looks_like_arrow(src: str, after_paren: int) -> bool:
    j = after_paren + 1
    while j < len(src) and src[j] in " \t\n":
        j += 1
    return src.startswith("=>", j)


def iter_frontend_funcs(src: str) -> list[tuple[str, int, int, int]]:
    """Yield (name, start_line0, length_lines, param_count)."""
    found: list[tuple[str, int, int, int]] = []
    n = len(src)

    def emit(name: str, start: int, brace_at: int, params: int) -> None:
        end = matching_brace(src, brace_at)
        start_line = line_index(src, start)
        end_line = line_index(src, end)
        found.append((name, start_line, end_line - start_line + 1, params))

    def body_after_params(j: int) -> tuple[int, int] | None:
        while j < n and src[j] in " \t\n":
            j += 1
        if j < n and src[j] == "<":
            depth = 0
            while j < n:
                if src[j] == "<":
                    depth += 1
                elif src[j] == ">":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                j += 1
        while j < n and src[j] in " \t\n":
            j += 1
        if j >= n or src[j] != "(":
            return None
        close = matching_paren(src, j)
        params = count_ts_params(src[j + 1 : close])
        k = close + 1
        while k < n and src[k] != "{":
            if src[k] == ";" or src[k] == "\n" and "{" not in src[k : k + 80]:
                if "=>" not in src[close:k]:
                    break
            k += 1
            if k - close > 400:
                break
        if k < n and src[k] == "{":
            return k, params
        return None

    for m in re.finditer(
        r"(?:^|(?<=[\n;{}()]))(?:export\s+)?(?:async\s+)?function\s+(\w+)",
        src,
    ):
        name = m.group(1)
        got = body_after_params(m.end())
        if got:
            brace, params = got
            emit(name, m.start(), brace, params)

    for m in re.finditer(
        r"(?:^|(?<=[\n;{}()]))(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(",
        src,
    ):
        name = m.group(1)
        paren = m.end() - 1
        close = matching_paren(src, paren)
        if not looks_like_arrow(src, close):
            continue
        params = count_ts_params(src[paren + 1 : close])
        k = close + 1
        while k < n and not src.startswith("=>", k):
            k += 1
        k += 2
        while k < n and src[k] in " \t\n":
            k += 1
        if k < n and src[k] == "{":
            emit(name, m.start(), k, params)

    return found


def check_frontend_function_length(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        raw = f.read_text()
        src = skip_ts_string_and_comment(raw)
        for name, start, length, _ in iter_frontend_funcs(src):
            if length > FE_FUNC_MAX:
                violations.append(
                    f"  {f.relative_to(PROJECT_ROOT)}:{start + 1} {name} = {length} lines"
                )
    return CheckResult(f"前端函数长度检查（≤ {FE_FUNC_MAX} 行）", not violations, violations)


def check_frontend_parameters(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        raw = f.read_text()
        src = skip_ts_string_and_comment(raw)
        for name, start, _, nparams in iter_frontend_funcs(src):
            if nparams > FE_PARAM_MAX:
                violations.append(
                    f"  {f.relative_to(PROJECT_ROOT)}:{start + 1} {name} = {nparams} params"
                )
    return CheckResult(f"前端函数参数检查（≤ {FE_PARAM_MAX} 个）", not violations, violations)


def check_frontend_file_length(prod: list[Path], tests: list[Path]) -> CheckResult:
    violations = []
    for f in prod:
        count = len(f.read_text().splitlines())
        if count > FE_PROD_FILE_MAX:
            violations.append(f"  {f.relative_to(PROJECT_ROOT)}: {count} lines")
    for f in tests:
        count = len(f.read_text().splitlines())
        if count > FE_TEST_FILE_MAX:
            violations.append(f"  {f.relative_to(PROJECT_ROOT)}: {count} lines (test)")
    return CheckResult(
        f"前端文件长度检查（生产 ≤ {FE_PROD_FILE_MAX}，测试 ≤ {FE_TEST_FILE_MAX}）",
        not violations,
        violations,
    )


def check_frontend_any_types(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        for i, line in enumerate(f.read_text().splitlines()):
            if re.search(r":\s*any\b|as\s+any\b|<any>", line):
                violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i + 1} {line.strip()[:60]}")
    return CheckResult("前端 any 类型检查", not violations, violations)


def check_frontend_class_components(files: list[Path]) -> CheckResult:
    violations = []
    for f in files:
        for i, line in enumerate(f.read_text().splitlines()):
            if re.search(r"class\s+\w+\s+extends\s+(Component|PureComponent)", line):
                violations.append(f"  {f.relative_to(PROJECT_ROOT)}:{i + 1} {line.strip()[:60]}")
    return CheckResult("前端 class 组件检查", not violations, violations)


def run_command(cmd: list[str], cwd: Path = PROJECT_ROOT) -> tuple[bool, str]:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return result.returncode == 0, result.stdout + result.stderr


def print_result(result: CheckResult) -> None:
    if result.passed:
        print(f"\033[32m✓ {result.name}\033[0m")
        return
    print(f"\033[31m✗ {result.name}\033[0m")
    for err in result.errors:
        print(err)


def main() -> None:
    hook_mode = "--hook" in sys.argv
    quick_mode = "--quick" in sys.argv

    print("━━━ 代码规范检查 ━━━")
    print(f"项目: {PROJECT_ROOT}")
    mode = "pre-commit hook" if hook_mode else ("快速检查" if quick_mode else "完整检查")
    print(f"模式: {mode}")
    print()

    go_prod = collect_go_files(hook_mode, tests=False)
    go_test = collect_go_files(hook_mode, tests=True)
    go_all = go_prod + go_test
    fe_prod = collect_frontend_files(hook_mode, tests=False, include_ui=False)
    fe_test = collect_frontend_files(hook_mode, tests=True, include_ui=False)
    fe_lint = collect_frontend_files(hook_mode, tests=False, include_ui=True) + collect_frontend_files(
        hook_mode, tests=True, include_ui=True
    )
    fe_size = fe_prod + fe_test

    results = [
        check_go_function_length(go_all),
        check_go_parameters(go_all),
        check_go_file_length(go_prod, go_test),
        check_go_doc_comments(go_prod),
        check_frontend_function_length(fe_size),
        check_frontend_parameters(fe_size),
        check_frontend_file_length(fe_prod, fe_test),
        check_frontend_any_types(fe_lint),
        check_frontend_class_components(fe_lint),
    ]

    if not hook_mode and not quick_mode:
        ok, output = run_command(["go", "build", "./..."])
        results.append(CheckResult("Go 构建检查", ok, [] if ok else [f"  {output.strip()[:200]}"]))
        ok, output = run_command(["go", "test", "./..."])
        fails = [f"  {line}" for line in output.splitlines() if "FAIL" in line]
        results.append(CheckResult("Go 测试检查", ok, fails))
        ok, output = run_command(["pnpm", "run", "build"], cwd=PROJECT_ROOT / "frontend")
        results.append(CheckResult("前端构建检查", ok, [] if ok else [f"  {output.strip()[:200]}"]))
        ok, output = run_command(["pnpm", "test"], cwd=PROJECT_ROOT / "frontend")
        results.append(CheckResult("前端测试检查", ok, [] if ok else [f"  {output.strip()[:200]}"]))

    print("━━━ 检查结果 ━━━")
    for r in results:
        print_result(r)

    errors = sum(1 for r in results if not r.passed)
    print()
    if errors > 0:
        print(f"\033[31m✗ {errors} 个检查未通过\033[0m")
        sys.exit(1)
    print("\033[32m✓ 所有检查通过\033[0m")
    sys.exit(0)


if __name__ == "__main__":
    main()
