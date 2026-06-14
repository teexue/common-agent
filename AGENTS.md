# common-agent 编码规范

通用 Agent 基座（Go 核心）。当前 Phase 1：生产基座。完整路线图见 [README.md](README.md)。

## 架构约束（最高优先级）

- **单入口 Agent Loop**：CLI / HTTP / gRPC 等所有路径必须调用同一个 `Run` 函数，禁止在 handler 内重复实现 loop
- **Tool 统一抽象**：一切能力通过 `Tool` 接口暴露，禁止在 loop 内 hardcode 业务逻辑
- **Agent 驱动差异**：提示词、工具白名单、权限、模型配置来自 Agent，禁止在 core 写 `switch agent` 分支
- **事件流输出**：对外统一 `AgentEvent`（`text_delta` / `tool_start` / `tool_result` / `error` / `done`）
- **依赖方向**：`cmd → server → core ← tools`；core 不得依赖 server / cmd

## 目录与包布局

```
cmd/agent-server/     # 入口，仅 wiring
core/{loop,event,session,agent,provider,config,permission,hook,telemetry,compaction,subagent,mcp,workflow,tenant,billing,skill}
tools/{registry,builtin}
server/{http,grpc}    # HTTP/SSE + gRPC handler
sdk/{ts,python}       # 客户端 SDK
```

运行时配置在 `~/.common-agent/`（`providers.yaml`、`credentials.yaml`、`agents/`）。仓库内不再存放用户配置。

- 包名小写、短、无下划线（`loop` 而非 `agent_loop`）
- 每个目录一个包；禁止 `util`、`common`、`helper` 包
- 跨包共享类型放语义明确的包（如 `core/event`、`core/agent`）

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

**Agent**（YAML，默认在 `~/.common-agent/agents/`）

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
- 统一字段：`session_id`, `agent`, `tool`, `turn`
- 不在 loop 热路径打大量 Debug 日志

## 禁止事项

- core 引入 HTTP/gRPC 框架依赖
- 创建 `utils`、`helpers`、`misc` 包
- loop 外直接调用 LLM Provider
- 跳过 Permission 检查执行 Tool（Phase 1 起强制）
- 为单个 Agent 写 if/else 分支
- 提交 `.env`、API Key、credentials
- 过度抽象（YAGNI）：Phase 0 不需要的 interface 不提前定义
- 手动编辑 `go.mod` 或 `package.json` 中的版本号 — 使用包管理器（`go mod`、`pnpm add`）自动解析

## 变更纪律

- 单次变更聚焦一个 Phase 子任务
- 新增 Tool 须同步：registry 注册 + agent 示例 + 测试
- 修改 AgentEvent schema 视为 breaking change，须注明
- 仅用户明确要求时才 git commit

## 文档维护规范

- `docs/html/` 是项目文档的权威来源。`docs/*.md` 是旧文档，已删除，不再维护。
- 文档为**多页面纯 HTML 站点**，由 `_assets/nav.js` 动态注入统一侧边栏导航。
- **index.html** — 首页/项目概览。
- **roadmap.html** — 开发计划 Roadmap。
- **核心模块页面**（`core/*.html`）— Tool、Provider、Event、Loop、Agent、Session、Config 等独立主题页。
- **执行流程页面**（`flow/*.html`）— 数据流、CLI 流程、HTTP 流程等。
- **开发指南页面**（`guide/*.html`）— 添加工具/Provider、目录结构等。
- 新增页面时：在对应目录新建 `.html` 文件 → 在 `_assets/nav-config.js` 注册导航链接 → 沿用统一模板（引用 `_assets/style.css` + `nav-config.js` + `nav.js` + `theme.js`）。
- 共享样式在 `docs/html/_assets/style.css`，页面特有样式可写在各自 `<style>` 标签内。
- **CLAUDE.md** — AI 助手的项目级指令（构建命令、架构、模式、文档管理规则）。
- **AGENTS.md** — 编码规范和开发纪律（本文件）。
