# 通用 Agent 基座

面向生产环境的 Agent Runtime，参考 Claude Code 等智能体架构，提供统一的 Agent 循环、工具扩展与对外接入能力。上层通过 Agent 配置适配不同业务场景，底层通过 SDK / gRPC / HTTP 供其他服务调用。

## 快速开始

```bash
go build -o bin/agent-server ./cmd/agent-server

# 1. 交互式初始化（写入 ~/.common-agent）
./bin/agent-server config init

# 或命令行配置
./bin/agent-server config set provider moonshot \
  --type openai --base-url https://api.moonshot.cn/v1 \
  --api-key-env MOONSHOT_API_KEY --model kimi-k2.6 --thinking disabled
./bin/agent-server config set-key MOONSHOT_API_KEY sk-...

# 2. 交互式终端对话
./bin/agent-server chat

# 3. 单次对话
./bin/agent-server run --prompt "what time is it?"

# 4. HTTP 服务
./bin/agent-server serve --addr :8080

# Mock 离线调试
./bin/agent-server chat --mock
```

## 配置目录 `~/.common-agent`

| 文件 | 说明 |
|------|------|
| `config.yaml` | 默认 agent |
| `providers.yaml` | 大模型服务商 |
| `credentials.yaml` | API Key（600 权限） |
| `agents/*.yaml` | Agent 配置 |

`agent-server config show` 查看当前配置。

## 大模型配置

**交互式**：`agent-server config init`

**命令行**：

```bash
agent-server config set provider moonshot \
  --type openai --base-url https://api.moonshot.cn/v1 \
  --api-key-env MOONSHOT_API_KEY --model kimi-k2.6 --thinking disabled
agent-server config set-key MOONSHOT_API_KEY sk-...
```

Agent 中指定 provider 与 model（位于 `~/.common-agent/agents/`）：

```yaml
provider: moonshot
model: kimi-k2.6
```

交互对话命令：`/help` `/exit` `/clear` `/agent NAME`

## 开发方向

- 以 **Agent Loop** 为核心，统一 CLI、SDK、gRPC、HTTP 的执行路径
- 以 **Tool** 为唯一能力抽象，支持内置工具、进程内插件与 MCP 扩展
- 以 **Agent** 承载多场景差异（提示词、工具集、权限、模型配置）
- 以 **事件流** 对外输出（text / tool / error / done），支持流式与同步两种调用
- 内置权限校验、Hook 钩子与会话管理，满足生产部署要求

## 开发计划

### Phase 0 — 最小闭环

- [x] 定义核心事件模型与 Agent Loop
- [x] 实现 LLM 调用与 1-2 个内置 Tool
- [x] 提供 HTTP SSE 接口与 CLI 调试入口
- [x] 完成第一个 Demo Agent

### Phase 1 — 生产基座

- [ ] Tool Registry 与 Agent 配置加载
- [ ] Session 持久化，支持 cancel / resume
- [ ] Permission 权限策略与基础 Hook
- [ ] gRPC streaming 服务
- [ ] TypeScript SDK（prompt + stream）
- [ ] OpenTelemetry 可观测性埋点

### Phase 2 — 扩展生态

- [ ] MCP Client 集成，动态发现外部工具
- [ ] Context Compaction 上下文压缩
- [ ] Sub-Agent 子任务派发
- [ ] Python SDK

### Phase 3 — 多场景生产

- [ ] Workflow DAG 工作流编排
- [ ] 多租户、配额与计费
- [ ] Agent 热更新与管理 API
- [ ] 会话回放与审计
