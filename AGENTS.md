# common-agent 编码规范

通用 Agent 基座（Go 核心）。当前 Phase 0：Agent Loop、内置 Tool、HTTP SSE。完整路线图见 [README.md](README.md)。

## 架构约束（最高优先级）

- **单入口 Agent Loop**：CLI / HTTP / gRPC 等所有路径必须调用同一个 `Run` 函数，禁止在 handler 内重复实现 loop
- **Tool 统一抽象**：一切能力通过 `Tool` 接口暴露，禁止在 loop 内 hardcode 业务逻辑
- **Scenario 驱动差异**：提示词、工具白名单、权限、模型配置来自 Scenario，禁止在 core 写 `switch scenario` 分支
- **事件流输出**：对外统一 `AgentEvent`（`text_delta` / `tool_start` / `tool_result` / `error` / `done`）
- **依赖方向**：`cmd → server → core ← tools`；core 不得依赖 server / cmd

## 目录与包布局

```
cmd/agent-server/     # 入口，仅 wiring
core/{loop,event,session,scenario,provider,permission}
tools/{registry,builtin}
server/http/          # HTTP/SSE handler
scenarios/            # YAML 场景配置
```

- 包名小写、短、无下划线（`loop` 而非 `agent_loop`）
- 每个目录一个包；禁止 `util`、`common`、`helper` 包
- 跨包共享类型放语义明确的包（如 `core/event`、`core/scenario`）

## Go 编码规范

风格基准：标准库风格 + [golangci-lint](.golangci.yml) 常用规则。

**命名**：导出 PascalCase（`RunAgent`）；未导出 camelCase；接口行为命名；文件 snake_case。

**错误处理**：`(T, error)` + `%w` 包装；handler 映射 HTTP 状态码，core 不感知 HTTP；禁止 panic 处理可预期错误。

**Context 与并发**：I/O/LLM 第一参数 `context.Context`，支持 cancellation；不在 struct 存 context；parallel tool 有上限；goroutine 可退出。

**接口设计**：小接口 + `NewXxx(deps...)` 注入；避免 `init()` 全局注册，Tool 显式注册到 Registry。

## 领域模型

**Tool**（core 层定义）

```go
type Tool interface {
    Name() string
    Description() string
    InputSchema() map[string]any
    Execute(ctx context.Context, input json.RawMessage) (ToolResult, error)
}
```

- 名称 snake_case，全局唯一（如 `read_file`）
- `Execute` 只做一件事；编排逻辑在 loop；Tool 不得直接调用 LLM

**AgentEvent**（core/event）

- 用 struct + `Type` 字段，禁止 `any` 裸传
- 新增事件类型须同步更新所有 consumer（HTTP SSE encoder 等）

**Scenario**（YAML，放 `scenarios/`）

- 启动时加载；校验失败 fail fast，禁止 silent fallback
- schema 变更需向后兼容或显式 `version` 字段

## server 层

- handler 只做：解析请求 → 调用 core → 编码事件流
- 禁止在 handler 写 Agent 逻辑、tool 执行、prompt 拼装
- 路由前缀 `/v1/`；SSE 用 `text/event-stream`
- 请求/响应 DTO 与 domain model 分离

## 测试

- 表驱动测试优先；Tool 和 loop 必须可 mock Provider / Registry
- 集成测试放 `test/integration/`，build tag `//go:build integration`
- 新功能覆盖 happy path + 至少一个 error path

## 日志（Phase 0）

- 使用 `log/slog` 结构化日志
- 统一字段：`session_id`, `scenario`, `tool`, `turn`
- 不在 loop 热路径打大量 Debug 日志

## 禁止事项

- core 引入 HTTP/gRPC 框架依赖
- 创建 `utils`、`helpers`、`misc` 包
- loop 外直接调用 LLM Provider
- 跳过 Permission 检查执行 Tool（Phase 1 起强制）
- 为单个 Scenario 写 if/else 分支
- 提交 `.env`、API Key、credentials
- 过度抽象（YAGNI）：Phase 0 不需要的 interface 不提前定义

## 变更纪律

- 单次变更聚焦一个 Phase 子任务
- 新增 Tool 须同步：registry 注册 + scenario 示例 + 测试
- 修改 AgentEvent schema 视为 breaking change，须注明
- 仅用户明确要求时才 git commit
