# CLAUDE.md

This file provides guidance to AI coding agents when working with code in this repository.

## Build and test commands

```bash
go build -o bin/agent-server ./cmd                  # build
go vet ./...                                        # vet
golangci-lint run                                   # lint (config in .golangci.yml)
go test ./...                                       # all tests
go test ./core/loop/                                # single package
go test -run TestRunWithMockProvider ./core/loop/    # single test

cd frontend && pnpm test                            # frontend tests
```

There is no `go generate`, `go install`, or Docker step at this phase.

## Dependency management

- **Go**: Use `go mod` to manage dependencies. Never manually edit `go.mod`.
- **Frontend (pnpm)**: Use `pnpm add` / `pnpm add -D` to add dependencies. Never manually edit `package.json` version numbers — let the package manager resolve the latest compatible version.

## Architecture

This is a Go agent runtime (`common-agent`).

**Dependency direction**: `cmd → server → core ← tools`. Core must not import `server` or `cmd`.

| Layer | Package | Purpose |
|-------|---------|---------|
| Entry | `cmd/` | CLI wiring only — subcommands: `chat`, `run`, `serve`, `config` |
| Transport | `server/http/` | HTTP/SSE handler — parse request → call core `loop.Run` → stream events |
| Core | `core/loop/` | The single agent loop — all paths (CLI/HTTP/gRPC) must call this `Run` |
| Core | `core/event/` | Unified event types: `text_delta`, `reasoning_delta`, `tool_start`, `tool_result`, `error`, `done` |
| Core | `core/provider/` | LLM provider interface (`Stream`) + OpenAI/Anthropic implementations + mock + catalog |
| Core | `core/tool/` | Tool interface (`Name/Description/InputSchema/Execute`) — `Result.Output` is `json.RawMessage` |
| Core | `core/agent/` | YAML agent loading (prompt, tools, model, max turns, max tokens, tool_execution) |
| Core | `core/session/` | Thread-safe conversation session with `AddMessages`/`GetMessages`/`Clear` API |
| Core | `core/config/` | User config in `~/.common-agent/` (settings, providers, `CredentialStore`, wizard) |
| Extension | `tools/registry/` | Tool registry (register by name, resolve definitions for LLM) |
| Built-in | `tools/builtin/` | Built-in tools: `echo`, `get_time`, `read_file`, `write_file`, etc. |

## Key patterns

- **Single loop entry**: Every interface (CLI, HTTP, future gRPC) wires up a `loop.Run` call — don't duplicate loop logic in handlers.
- **Tool as the only abstraction**: All capabilities go through the `Tool` interface. The loop does NOT hardcode tool behavior.
- **Agent drives everything**: Prompt, tool whitelist, model, provider, max turns, max tokens, and tool execution strategy come from an agent YAML file. Core has no `switch agent` branches.
- **Tool execution modes**: Agent `tool_execution.mode` controls whether tools execute in parallel (streaming, default) or serial. `tool_execution.max_parallel` limits concurrency (default 4).
- **Mocks for testing**: Use `provider.MockProvider` (which supports `Text`, `Reasoning`, and `ToolCalls` per step) and `provider.EchoThenReply()` to test the loop without real LLM calls.
- **Config lives in `~/.common-agent/`**: `config.yaml` (settings), `providers.yaml` (LLM providers), `credentials.yaml` (API keys), `agents/*.yaml` (agent definitions). Never commit credentials or `.env` files.
- **Credentials**: Use `config.NewCredentialStore(home)` to create a thread-safe store; pass its `Lookup` method to `provider.LoadCatalog`. Legacy package-level functions are deprecated.
- **Tool naming**: snake_case, globally unique (e.g., `read_file`). Register explicitly via `registry.Register()`, not `init()` magic.
- **Provider resolution**: The `cmd` layer resolves provider by name from catalog → creates concrete `provider.Provider`. Core only sees the interface.
- **HTTP clients**: Providers use `provider.DefaultHTTPClient()` (120s timeout) instead of `http.DefaultClient`.
- **Thinking/reasoning**: OpenAI-compatible `ThinkingConfig` controls Kimi-style reasoning mode. `ReasoningDelta` events are emitted to the event stream.

## Events are the contract

`core/event.Event` is the universal output format. Adding a new event type requires updating all consumers: `PrintEvents` in `core/event`, HTTP SSE encoder in `server/http`, and any future gRPC handler.

## Coding standards

编码规范以 [AGENTS.md](AGENTS.md) 为准，本文件仅记录 AI 代理工作时需要特别注意的要点：

### 可维护性约束

| 指标 | Go | 前端 |
|------|-----|------|
| 单文件行数 | ≤ 500 行（测试 ≤ 600） | ≤ 400 行（测试 ≤ 600） |
| 单函数行数 | ≤ 80 行 | ≤ 60 行 |
| 函数参数数 | ≤ 5 个 | ≤ 5 个 |
| 嵌套深度 | ≤ 4 层 | ≤ 4 层 |

### Go 规范要点

- 导出符号必须有 doc comment（以名称开头的简短注释）
- 错误用 `fmt.Errorf("context: %w", err)` 包装，早返回
- Context 不存 struct，第一参数传入
- 小接口 + `NewXxx(deps...)` 注入，避免 `init()` 注册
- Import 三组分隔：标准库 / 外部 / 内部
- 测试推荐 `testify/assert` + `testify/require`，表驱动优先

### 前端规范要点

- 无分号、双引号、2 空格缩进（Prettier 强制）
- 函数组件 + hooks，禁止 class 组件
- 禁止 `any` 类型
- Tailwind utility-first，用 `cn()` 合并类名
- 组件文件 PascalCase，工具函数 camelCase

### Git 规范

- Commit: Conventional Commits 格式 — `feat(core/loop): description`
- 分支: `feat/<name>`、`fix/<name>`

## Agent YAML reference

```yaml
id: agt_demo01          # 稳定主键；文件名 agents/{id}.yaml
name: demo              # 显示名，可改
version: 1
provider: anthropic
model: claude-sonnet-4-20250514
system_prompt: |
  You are a helpful assistant.
tools:
  - echo
  - get_time
max_turns: 10
max_tokens: 4096
tool_execution:
  mode: parallel       # parallel | serial
  max_parallel: 4      # max concurrent tools
```
