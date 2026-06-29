# common-agent 编码规范

通用 Agent 基座（Go 核心 + React 前端）。

> **权威来源**: 完整编码规范见 [`docs/html/code-standards.html`](docs/html/code-standards.html)。本文档为各 AI 代理（Cursor 等）提供精简指引，如有冲突以 HTML 文档为准。

## 架构约束（最高优先级）

- **单入口 Agent Loop**：CLI / HTTP / gRPC 等所有路径必须调用同一个 `loop.Run` 函数
- **Tool 统一抽象**：一切能力通过 `Tool` 接口暴露，禁止在 loop 内 hardcode 业务逻辑
- **Agent 驱动差异**：提示词、工具白名单、权限、模型配置来自 Agent YAML，禁止在 core 写 `switch agent` 分支
- **事件流输出**：对外统一 `event.Event`（`text_delta` / `reasoning_delta` / `tool_start` / `tool_result` / `error` / `done`）
- **依赖方向**：`cmd → server → core ← tools`；core 不得依赖 server / cmd

## 目录与包布局

```
cmd/agent-server/     # 入口，仅 wiring
core/{loop,event,session,agent,provider,config,permission,hook,telemetry,compaction,subagent,mcp,workflow,tenant,billing,skill}
tools/{registry,builtin}
server/{http,grpc}
frontend/             # React SPA（Vite + Tailwind + shadcn）
sdk/{ts,python}
```

- 包名小写、短、无下划线（`loop` 而非 `agent_loop`）
- 每个目录一个包；禁止 `util`、`common`、`helper` 包
- 跨包共享类型放语义明确的包（如 `core/event`、`core/agent`）

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
- **样式**：Tailwind utility-first，用 `cn()` 合并类名，禁止内联 style
- **命名**：组件文件 PascalCase，工具函数 camelCase，hooks 以 `use` 前缀
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

## 文档维护

- `docs/html/` 是权威文档层，多页面纯 HTML 站点
- 新增页面：创建 `.html` → 注册 `_assets/nav-config.js` → 沿用模板（`_assets/style.css` + `nav.js` + `theme.js`）
- 共享样式在 `_assets/style.css`，页面特有样式写在 `<style>` 标签内
