<div align="center">
  <h1>Common Agent</h1>
  <p><strong>面向生产环境的通用 Agent Runtime 基座</strong></p>
  <p>
    <a href="#quickstart">快速开始</a> ·
    <a href="#features">特性</a> ·
    <a href="#architecture">架构</a> ·
    <a href="#project-structure">目录</a> ·
    <a href="#roadmap">路线图</a>
  </p>
  <p>
    <img alt="Go" src="https://img.shields.io/badge/Go-1.26+-00ADD8?logo=go"/>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react"/>
    <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow"/>
  </p>
</div>

<p align="center">
基于单一 Agent Loop 架构的自托管运行时。通过<strong>单一 Agent Loop</strong>统一 CLI、HTTP SSE、gRPC 的执行路径，以<strong>配置驱动</strong>的方式适配不同业务场景，内置工具扩展、权限校验、会话管理与可观测性。
</p>

---

## 📦 快速开始 <a name="quickstart"></a>

### 构建

```bash
# 需要 Go 1.22+ 和 Node.js 20+
git clone https://github.com/teexue/common-agent.git
cd common-agent

# 构建前端
cd frontend && pnpm install && pnpm build && cd ..

# 构建后端
go build -o bin/agent-server ./cmd/agent-server
```

### 初始化

```bash
# 交互式向导：选择 LLM 提供商、配置 API Key
./bin/agent-server config init

# 或命令行配置
./bin/agent-server config set provider moonshot \
  --type openai --base-url https://api.moonshot.cn/v1 \
  --api-key-env MOONSHOT_API_KEY --model kimi-k2.6 --thinking disabled
./bin/agent-server config set-key MOONSHOT_API_KEY sk-...
```

### 运行

```bash
# 交互式终端对话（支持 /help /agent /clear /exit）
./bin/agent-server chat

# 单次对话
./bin/agent-server run --prompt "what time is it?"

# HTTP 服务 + Web 前端（默认 :8080）
./bin/agent-server serve

# 离线调试（Mock Provider，不调用真实 LLM）
./bin/agent-server chat --mock
```

---

## ✨ 核心特性 <a name="features"></a>

### 🎯 单一 Agent Loop
所有入口（CLI、HTTP、gRPC）共享同一个 `loop.Run()` 执行引擎。核心不感知传输层，事件流统一输出，确保行为一致性。

### 🔧 Tool 统一抽象
一切能力通过 `Tool` 接口暴露：内置工具（文件读写、代码搜索、命令执行、网络请求）与 MCP 外部工具，均通过统一注册表注册。Loop 内无硬编码业务逻辑。

### ⚙️ 配置驱动 Agent
提示词、工具白名单、权限策略、模型配置均来自 Agent YAML 文件。零代码创建新 Agent 场景，无需修改核心代码。

### 📡 事件流输出
统一的事件模型（`text_delta` / `reasoning_delta` / `tool_start` / `tool_result` / `error` / `done`），支持流式 SSE 与同步调用。

### 🛡️ 生产就绪
- **权限校验** — 细粒度的工具执行权限策略
- **生命周期 Hook** — 支持 turn 开始/结束等钩子
- **会话管理** — 持久化存储，支持 cancel/resume
- **OpenTelemetry** — 分布式追踪与指标采集
- **可审计** — 事件日志记录与 replay
- **i18n** — 国际化消息系统

### 🤖 内置工具集
| 工具 | 说明 |
|------|------|
| `echo` | 消息回显 |
| `get_time` | 获取当前 UTC 时间 |
| `read_file` / `write_file` | 文件读写 |
| `edit_file` | 精确文本替换编辑 |
| `list_directory` | 列出目录内容 |
| `search_files` | 正则搜索文件内容 |
| `create_directory` | 创建目录 |
| `run_command` | 执行 Shell 命令 |
| `web_fetch` | HTTP 请求获取网页内容 |

### 🌐 多协议接入
- **CLI** — 交互式 chat / 单次 run
- **HTTP SSE** — `/v1/agents/run` 流式接口
- **gRPC** — Protocol Buffers streaming 服务
- **React SPA** — 内置 Web 前端（Vite + Tailwind + shadcn）
- **SDK** — TypeScript / Python 客户端

### 🗓️ 定时任务
内置 Cron 式作业调度器，支持 Agent 定时执行、暂停/恢复、执行历史查询。

---

## 🏗️ 整体架构 <a name="architecture"></a>

```
┌─────────────────────────────────────────────────────────────┐
│                    传输层 (Transport)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  CLI (chat)  │  │  HTTP SSE    │  │  gRPC Streaming  │    │
│  │  /run/serve  │  │  (Gin)       │  │  (Protobuf)      │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘    │
│         │                 │                    │              │
└─────────┼─────────────────┼────────────────────┼──────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                       核心层 (Core)                          │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │  loop     │  │ provider │  │ event     │  │ session  │  │
│  │  循环引擎  │  │ LLM 接口  │  │ 事件系统   │  │ 会话管理  │  │
│  └───────────┘  └──────────┘  └───────────┘  └──────────┘  │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  agent    │  │ tool     │  │ permission│  │ hook      │ │
│  │  YAML 配置 │  │ 工具接口  │  │ 权限策略  │  │ 生命周期钩│ │
│  └───────────┘  └──────────┘  └──────────┘  └───────────┘ │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐               │
│  │ config    │  │ telemetry│  │ i18n      │               │
│  │  配置管理  │  │ 可观测性  │  │ 国际化    │               │
│  └───────────┘  └──────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                     实现层 (Implementation)                  │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ tools/registry │  │ tools/builtin │  │ core/mcp       │  │
│  │ 工具注册表     │  │ 内置工具实现   │  │ MCP 客户端     │  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ core/agent    │  │ core/compaction│  │ core/subagent  │  │
│  │ Watcher 热加载 │  │ 上下文压缩    │  │ 子任务派发     │  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ core/job      │  │ core/audit     │  │ core/skill     │  │
│  │ 定时任务调度  │  │ 事件审计日志   │  │ 技能系统       │  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 依赖方向

```
cmd → server → core ← tools
```

- `cmd/` — 入口层，仅做依赖装配与 CLI 路由
- `server/` — 传输层，HTTP/gRPC handler 调用 `loop.Run`
- `core/` — 核心层，纯业务逻辑，不依赖传输层
- `tools/` — 工具实现，依赖 core 的 `tool.Tool` 接口

> **核心约束**：`core` 不得导入 `server` 或 `cmd`，保持核心层与传输层解耦。

---

## 📁 目录结构 <a name="project-structure"></a>

```
├── cmd/agent-server/       # CLI 入口（chat/run/serve/config/sessions/tools/validate）
│   ├── main.go             # 子命令路由与依赖装配
│   ├── chat.go             # 交互式终端对话
│   ├── config.go           # 配置管理子命令
│   ├── sessions.go         # 会话管理
│   ├── skills.go           # 技能系统
│   ├── runtime.go          # 运行时初始化
│   └── templates.go        # Agent 模板管理
├── core/                   # 核心层
│   ├── loop/               # Agent 循环引擎（单入口 Run 函数）
│   ├── event/              # 统一事件模型
│   ├── provider/           # LLM Provider 接口（OpenAI/Anthropic/Moonshot/Mock）
│   ├── agent/              # Agent YAML 配置加载与校验
│   ├── session/            # 对话会话管理（FileStore 持久化）
│   ├── tool/               # Tool 接口定义
│   ├── config/             # 用户配置（~/.common-agent/）
│   ├── permission/         # 工具执行权限策略
│   ├── hook/               # 生命周期钩子
│   ├── telemetry/          # OpenTelemetry 可观测性
│   ├── i18n/               # 国际化
│   ├── mcp/                # MCP Client 集成
│   ├── compaction/         # 上下文压缩
│   ├── subagent/           # 子 Agent 派发
│   ├── job/                # 定时任务调度
│   ├── audit/              # 审计事件日志
│   ├── service/            # 共享业务逻辑层
│   ├── billing/            # 计费模块（预留）
│   ├── tenant/             # 多租户（预留）
│   ├── workflow/           # 工作流编排（预留）
│   ├── skill/              # 技能系统（预留）
│   └── tui/                # 终端 UI 渲染
├── server/
│   ├── http/               # HTTP SSE 服务（Gin）
│   └── grpc/               # gRPC streaming 服务
├── tools/
│   ├── registry/           # 工具注册表
│   └── builtin/            # 内置工具实现
├── frontend/               # React SPA（Vite + Tailwind + shadcn）
├── sdk/
│   ├── ts/                 # TypeScript SDK
│   └── python/             # Python SDK
├── proto/                  # Protocol Buffers 定义
├── docs/html/              # 项目文档站点
├── scripts/                # 辅助脚本
├── AGENTS.md               # AI 代理编码指引
├── CLAUDE.md               # AI 代理工作指引
└── Makefile                # 构建脚本
```

---

## 🧪 开发

### 构建

```bash
make              # 同时构建前端和后端
make backend      # 仅构建 Go 后端
make frontend     # 仅构建前端 SPA
```

### 测试

```bash
go test ./...                         # 全部 Go 测试
go test ./core/loop/                  # 单包测试
go test -run TestRunWithMockProvider ./core/loop/  # 单测
cd frontend && pnpm test              # 前端测试
```

### 校验

```bash
go vet ./...          # 静态分析
golangci-lint run     # Lint
```

### Agent YAML 示例

```yaml
name: my-assistant
version: 1
provider: moonshot
model: kimi-k2.6
system_prompt: |
  You are a helpful assistant with access to file operations.
tools:
  - read_file
  - write_file
  - search_files
  - get_time
max_turns: 10
max_tokens: 4096
tool_execution:
  mode: parallel       # parallel | serial
  max_parallel: 4      # max concurrent tools
```

---

## 🛤️ 开发路线图 <a name="roadmap"></a>

### ✅ Phase 0 — 最小闭环（已完成）
- [x] 核心事件模型与 Agent Loop 引擎
- [x] LLM Provider 接口（OpenAI / Anthropic / Moonshot / Mock）
- [x] HTTP SSE 流式接口 + CLI 调试入口
- [x] 首个 Demo Agent 与内置工具

### 🔄 Phase 1 — 生产基座（进行中）
- [x] Tool Registry 与 Agent YAML 配置加载
- [x] Session 持久化（FileStore）
- [x] Permission 权限策略与 Hook 钩子
- [x] gRPC streaming 服务
- [x] OpenTelemetry 可观测性埋点
- [x] i18n 国际化支持
- [ ] TypeScript SDK（prompt + stream）
- [ ] Python SDK
- [x] 定时任务调度器
- [x] MCP Client 集成
- [x] 上下文压缩（Context Compaction）
- [x] Agent 热更新（Watcher）
- [x] 事件审计日志（Event Logger / Replay）
- [x] 会话回放（Session Replay）
- [x] 技能系统（Skills）

### 🗓️ Phase 2 — 扩展生态
- [ ] Sub-Agent 子任务派发
- [ ] Context Budget 上下文预算管理
- [ ] Workflow DAG 工作流编排
- [ ] Agent 模板市场

### 🗓️ Phase 3 — 多场景生产
- [ ] 多租户与配额管理
- [ ] 计费系统
- [ ] Agent 管理 API 完善
- [ ] 会话审计与回放

---

## 📐 设计原则

| 原则 | 说明 |
|------|------|
| **单入口 Loop** | 所有路径必须调用同一 `loop.Run` |
| **Tool 统一抽象** | 一切能力通过 `Tool` 接口，禁止在 loop 内 hardcode |
| **配置驱动 Agent** | 禁止在 core 写 `switch agent` 分支 |
| **事件流契约** | 对外统一 `event.Event` 格式 |
| **依赖方向** | `cmd → server → core ← tools`，core 不得依赖 server/cmd |
| **小接口** | 避免过度抽象，YAGNI |

---

## 📖 文档

项目文档以纯 HTML 站点形式维护在 [`docs/html/`](docs/html/)：

- [项目概览](docs/html/index.html)
- [快速开始](docs/html/quickstart.html)
- [整体架构](docs/html/architecture.html)
- [编码规范](docs/html/code-standards.html)
- [开发计划](docs/html/roadmap.html)

---

## 🤝 贡献

- **Commit** 采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：
  `feat(core/loop): support tool approval flow`
- **分支** 命名：`feat/<name>`、`fix/<name>`
- 新增 Tool 须同步：registry 注册 + agent 示例 + 测试
- 修改事件 schema 视为 breaking change

详细规范见 [AGENTS.md](AGENTS.md) 与 [docs/html/code-standards.html](docs/html/code-standards.html)。
