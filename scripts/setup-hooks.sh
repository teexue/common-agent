#!/usr/bin/env bash
# setup-hooks.sh — 安装 git hooks
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "安装 git hooks..."

if [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo "备份现有 pre-commit hook..."
  cp "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.bak"
fi

cp "$PROJECT_ROOT/scripts/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✓ pre-commit hook 已安装"
echo ""
echo "手动运行: python3 scripts/check-standards.py"
echo "跳过 hook: git commit --no-verify"
