# 通用 Agent 基座

面向生产环境的 Agent Runtime，参考 Claude Code 等智能体架构，提供统一的 Agent 循环、工具扩展与对外接入能力。上层通过 Scenario 配置适配不同业务场景，底层通过 SDK / gRPC / HTTP 供其他服务调用。

## 开发方向

- 以 **Agent Loop** 为核心，统一 CLI、SDK、gRPC、HTTP 的执行路径
- 以 **Tool** 为唯一能力抽象，支持内置工具、进程内插件与 MCP 扩展
- 以 **Scenario** 承载多场景差异（提示词、工具集、权限、模型配置）
- 以 **事件流** 对外输出（text / tool / error / done），支持流式与同步两种调用
- 内置权限校验、Hook 钩子与会话管理，满足生产部署要求

## 开发计划

### Phase 0 — 最小闭环

- [ ] 定义核心事件模型与 Agent Loop
- [ ] 实现 LLM 调用与 1-2 个内置 Tool
- [ ] 提供 HTTP SSE 接口与 CLI 调试入口
- [ ] 完成第一个 Demo Scenario

### Phase 1 — 生产基座

- [ ] Tool Registry 与 Scenario 配置加载
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
- [ ] Scenario 热更新与管理 API
- [ ] 会话回放与审计
