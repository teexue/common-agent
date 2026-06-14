# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and test commands

```bash
go build -o bin/agent-server ./cmd/agent-server    # build
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

This is a Go agent runtime (`common-agent`). The project is in **Phase 1** (production base). See `AGENTS.md` for detailed coding conventions.

**Dependency direction**: `cmd → server → core ← tools`. Core must not import `server` or `cmd`.

| Layer | Package | Purpose |
|-------|---------|---------|
| Entry | `cmd/agent-server/` | CLI wiring only — subcommands: `chat`, `run`, `serve`, `config` |
| Transport | `server/http/` | HTTP/SSE handler — parse request → call core `loop.Run` → stream events |
| Core | `core/loop/` | The single agent loop — all paths (CLI/HTTP/gRPC) must call this `Run` |
| Core | `core/event/` | Unified event types: `text_delta`, `reasoning_delta`, `tool_start`, `tool_result`, `error`, `done` + `PrintEvents`, `StreamEvents` |
| Core | `core/provider/` | LLM provider interface (`Stream`) + OpenAI/Anthropic implementations + mock + catalog |
| Core | `core/tool/` | Tool interface (`Name/Description/InputSchema/Execute`) — `Result.Output` is `json.RawMessage` |
| Core | `core/agent/` | YAML agent loading (prompt, tools, model, max turns, max tokens, tool_execution) |
| Core | `core/session/` | Thread-safe conversation session with `AddMessages`/`GetMessages`/`Clear` API |
| Core | `core/config/` | User config in `~/.common-agent/` (settings, providers, `CredentialStore`, wizard) |
| Extension | `tools/registry/` | Tool registry (register by name, resolve definitions for LLM) |
| Built-in | `tools/builtin/` | Built-in tools: `echo`, `get_time` |

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

## Documentation management

- **Authority**: `docs/html/` is the authoritative documentation layer. All `docs/*.md` files are legacy reference only — do not treat them as source of truth.
- **index.html**: Records the completed project state — architecture, core modules, API reference, development guides. Updated each phase when features are DONE.
- **roadmap.html**: The development plan — detailed task breakdowns per phase with sub-tasks, acceptance criteria, dependencies, and complexity estimates. Updated at the START of each phase to define scope, and throughout as tasks progress.
- **When implementing a phase**: Update `roadmap.html` to mark subtasks as done, then update `index.html` to document newly completed features.
- **New HTML docs**: When a phase has substantial new capabilities, create a dedicated HTML page (e.g., `mcp-integration.html`) and link it from both `index.html` and `roadmap.html`.
- **CSS**: All HTML docs share `docs/html/css/style.css`. Add page-specific styles in `<style>` tags within each HTML file — do not modify shared CSS unless the change benefits all pages.
- **CLAUDE.md** records project-level instructions for AI assistants (build commands, architecture, patterns).
- **AGENTS.md** records coding conventions and development discipline rules.

## Agent YAML reference

```yaml
name: demo
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
