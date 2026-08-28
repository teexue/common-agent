# common-agent 编码规范

通用 Agent 基座（Go 核心 + React 前端）。本文档为各 AI 代理提供编码指引。

## 构建与测试

```bash
go build -o bin/agent-server ./cmd                  # 构建
go vet ./...                                        # vet
golangci-lint run                                   # lint（配置见 .golangci.yml）
go test ./...                                       # 全部测试
go test ./core/loop/                                # 单包
go test -run TestRunWithMockProvider ./core/loop/    # 单测

cd frontend && pnpm test                            # 前端测试
```

当前阶段没有 `go generate`、`go install` 或 Docker 步骤。

- **Go**：用 `go mod` 管理依赖，禁止手改 `go.mod` 版本号
- **前端**：用 `pnpm add` / `pnpm add -D` 加依赖，禁止手改 `package.json` 版本号

## 架构约束（最高优先级）

- **单入口 Agent Loop**：CLI / HTTP / gRPC 等所有路径必须调用同一个 `loop.Run` 函数，禁止在 handler 里复制 loop 逻辑
- **Tool 统一抽象**：一切能力通过 `Tool` 接口暴露，禁止在 loop 内 hardcode 业务逻辑
- **Agent 驱动差异**：提示词、工具白名单、权限、模型配置来自 Agent YAML，禁止在 core 写 `switch agent` 分支
- **事件流输出**：对外统一 `event.Event`（`text_delta` / `reasoning_delta` / `tool_start` / `tool_result` / `error` / `done`）
- **事件是契约**：新增 event 类型须同步所有消费方：`core/event` 的 `PrintEvents`、`server/http` 的 SSE 编码器、以及未来的 gRPC handler
- **依赖方向**：`cmd → server → core ← tools`；core 不得依赖 server / cmd

## 目录与包布局

```
cmd/                  # 入口，仅 wiring
core/{loop,event,session,agent,provider,config,permission,hook,telemetry,compaction,subagent,mcp,workflow,tenant,billing,skill}
tools/{registry,builtin}
server/{http,grpc}
frontend/             # React SPA（Vite + Tailwind + shadcn）
sdk/{ts,python}
```

| 层 | 包 | 职责 |
|----|----|------|
| 入口 | `cmd/` | CLI wiring；默认命令启动 Web UI（`web`；`serve` 为别名） |
| 传输 | `server/http/` | HTTP/SSE：解析请求 → 调用 `loop.Run` → 流式事件 |
| 核心 | `core/loop/` | 唯一 Agent Loop；所有路径必须走 `Run` |
| 核心 | `core/event/` | 统一事件类型 |
| 核心 | `core/provider/` | LLM `Stream` 接口 + OpenAI/Anthropic + mock + catalog |
| 核心 | `core/tool/` | Tool 接口（`Name/Description/InputSchema/Execute`）；`Result.Output` 为 `json.RawMessage` |
| 核心 | `core/agent/` | YAML 加载（prompt、tools、model、max turns、max tokens、tool_execution） |
| 核心 | `core/session/` | 线程安全会话：`AddMessages` / `GetMessages` / `Clear` |
| 核心 | `core/config/` | 用户配置 `~/.common-agent/`（settings、providers、`CredentialStore`、wizard） |
| 扩展 | `tools/registry/` | 按名注册工具，解析给 LLM 的 definitions |
| 内置 | `tools/builtin/` | `get_time`、`read_file`、`write_file` 等 |

- 包名小写、短、无下划线（`loop` 而非 `agent_loop`）
- 每个目录一个包；禁止 `util`、`common`、`helper` 包
- 跨包共享类型放语义明确的包（如 `core/event`、`core/agent`）

## 关键约定

- **工具执行**：Agent `tool_execution.mode` 控制并行（流式，默认）或串行；`tool_execution.max_parallel` 限制并发（默认 4）
- **测试 Mock**：用 `provider.MockProvider`（每步可设 `Text` / `Reasoning` / `ToolCalls`）和 `provider.EchoThenReply()`，无需真实 LLM
- **配置目录**：`~/.common-agent/` — `config.yaml`（设置）、`providers.yaml`（供应商）、`credentials.yaml`（API Key）、`agents/*.yaml`（Agent 定义）。禁止提交 credentials 或 `.env`
- **凭证**：`config.NewCredentialStore(home)` 创建线程安全 store，将其 `Lookup` 传给 `provider.LoadCatalog`；包级旧函数已废弃
- **工具命名**：snake_case，全局唯一（如 `read_file`）。通过 `registry.Register()` 显式注册，禁止 `init()` 魔法注册
- **Provider 解析**：`cmd` 层按名从 catalog 解析并创建具体 `provider.Provider`；core 只依赖接口
- **HTTP 客户端**：Provider 使用 `provider.DefaultHTTPClient()`（120s 超时），禁止 `http.DefaultClient`
- **思考/推理**：OpenAI 兼容的 `ThinkingConfig` 控制 Kimi 风格 reasoning；`ReasoningDelta` 写入事件流

## Agent YAML 参考

```yaml
id: agt_demo01          # 稳定主键；文件名 agents/{id}.yaml
name: demo              # 显示名，可改
version: 1
provider: anthropic
model: claude-sonnet-4-20250514
system_prompt: |
  You are a helpful assistant.
tools:
  - read_file
  - get_time
max_turns: 10
max_tokens: 4096
tool_execution:
  mode: parallel       # parallel | serial
  max_parallel: 4      # max concurrent tools
compaction:
  strategy: cascade    # cascade（默认）| truncation | sliding_window | summarize
  trigger_ratio: 1.0   # 用量超过 window*ratio 时压缩（默认 1.0 = window − summary budget）
  target_ratio: 0.6    # 压到 window*ratio（必须低于 trigger）
  keep_recent: 20      # 最近对话原文保留
  keep_head: 2         # 最旧消息作为稳定 cache 前缀保留
  summary_model: ""    # summarize 策略用的模型；空 = Agent 模型
```

## 可维护性约束

| 指标 | Go | 前端 |
|------|-----|------|
| 单文件行数 | ≤ 500 行（测试 ≤ 600） | ≤ 400 行（测试 ≤ 600） |
| 单函数行数 | ≤ 80 行 | ≤ 60 行 |
| 单组件行数 | — | ≤ 200 行 |
| 函数参数数 | ≤ 5 个（超过用 Config struct 封装） | ≤ 5 个（超过用 options object） |
| 嵌套深度 | ≤ 4 层（超过用早返回或提取子函数） | ≤ 4 层 |
| 圈复杂度 | ≤ 15 | ≤ 15 |

## Go 编码规范

- **命名**：导出 PascalCase，未导出 camelCase，文件 snake_case，工具名 snake_case
- **Import**：三组分隔 — 标准库 / 外部依赖 / 内部包
- **错误处理**：`(T, error)` + `fmt.Errorf("context: %w", err)` 包装；早返回；禁止 panic 处理可预期错误
- **Context**：I/O/LLM 第一参数，不存 struct，支持 cancellation
- **接口**：小接口 + `NewXxx(deps...)` 注入；避免 `init()` 全局注册
- **注释**：导出符号必须有 doc comment（以名称开头的简短注释）
- **日志**：`log/slog` 结构化日志，统一字段 `session_id` / `agent` / `tool` / `turn`

## 前端编码规范

- **格式**：无分号、双引号、2 空格缩进、尾逗号 ES5（Prettier 强制）
- **组件**：函数组件 + hooks，禁止 class 组件，禁止 `any` 类型
- **样式**：Tailwind utility-first，用 `cn()` 合并类名，禁止内联 style（动态计算值如进度百分比、背景图 URL 除外）；颜色必须用 index.css 设计 token（primary / muted-foreground / success / warning / chart-*），禁止散装色板类
- **页面原语**：页面必须经由 `components/shared/` 的 PageHeader / PageShell / PageMain / EmptyState / ListRow 组装，禁止手写页头与空态拷贝
- **命名**：组件文件 kebab-case，工具函数 camelCase，hooks 以 `use` 前缀
- **TypeScript**：strict mode，对象用 `interface`，联合用 `type`，优先 `as const` 替代 `enum`

## 测试

- **Go**：表驱动测试优先；推荐 `testify/assert` + `testify/require`；覆盖 happy path + 至少一个 error path
- **前端**：vitest + React Testing Library；测试纯函数和 hooks
- **集成测试**：`test/integration/`，build tag `//go:build integration`

## Git 规范

- **Commit**：Conventional Commits — `<type>(<scope>): <description>`
- **Type**：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf` / `style`
- **分支**：`feat/<name>`、`fix/<name>`，短横线分隔，全小写
- **PR**：标题遵循 Conventional Commits，关联 Issue，变更聚焦单一子任务

## 禁止事项

| 禁止 | 原因 |
|------|------|
| core 引入 HTTP/gRPC 框架依赖 | 违反依赖方向 |
| 创建 `utils` / `helpers` / `misc` 包 | 包无明确语义 |
| loop 外直接调用 LLM Provider | 绕过权限和审计 |
| 跳过 Permission 检查执行 Tool | 安全漏洞 |
| 为单个 Agent 写 if/else 分支 | Agent 配置驱动 |
| panic 处理可预期错误 | 应返回 error |
| struct 存储 context | 违反 Go 最佳实践 |
| 前端使用 `any` 类型 | 破坏类型安全 |
| 前端 class 组件 | 项目统一函数组件 |
| 提交 `.env` / API Key / credentials | 安全风险 |
| 手动编辑 `go.mod` / `package.json` 版本号 | 使用包管理器 |
| 过度抽象（YAGNI） | 不需要的 interface 不提前定义 |

## 变更纪律

- 单次变更聚焦一个子任务
- 新增 Tool 须同步：registry 注册 + agent 示例 + 测试
- 修改 AgentEvent schema 视为 breaking change，须注明
- 仅用户明确要求时才 git commit
