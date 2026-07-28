<div align="center">
  <h1>Common Agent</h1>
  <p><strong>面向生产环境的通用 Agent Runtime 基座</strong></p>
  <p>
    <img alt="Go" src="https://img.shields.io/badge/Go-1.26+-00ADD8?logo=go"/>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react"/>
    <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow"/>
  </p>
</div>

基于单一 Agent Loop 架构的自托管运行时。通过 YAML 配置定义 Agent，即可在终端、Web 界面或 API 中获得具备工具调用能力的 AI 助手。

## 功能

- **多种使用方式** — 交互式终端（chat）、单条命令（run）、HTTP SSE 接口、gRPC 流式接口、内置 Web 界面，以及 TypeScript / Python SDK
- **配置驱动 Agent** — 一份 YAML 定义一个 Agent：系统提示词、模型、可用工具、权限策略，零代码创建新场景
- **多 LLM 提供商** — 支持 OpenAI 兼容接口（DeepSeek、Moonshot 等）与 Anthropic，可配置多家按 Agent 切换
- **内置工具集** — 文件读写、目录浏览、内容搜索、Shell 命令、网页抓取等，开箱即用
- **MCP 扩展** — 接入 MCP Server 外部工具，全局或按 Agent 配置
- **权限与审批** — 细粒度工具权限策略，危险操作需人工确认后执行
- **会话管理** — 对话持久化存储，支持多会话切换与历史回顾
- **定时任务** — Cron 式作业调度，让 Agent 定时自动执行，支持暂停/恢复与执行历史
- **知识库（RAG）** — 文档导入与向量检索，Agent 回答时自动引用知识
- **技能系统** — 可复用的技能包（SKILL.md），按需加载扩展 Agent 能力
- **Web 界面** — 会话管理、Agent 管理、提供商配置、主题切换、自定义背景（含动态壁纸）等
- **可观测与审计** — 运行事件日志、健康检查与指标，支持审计查询
- **国际化** — 中英文界面与消息

## 快速开始

```bash
make                            # 构建（需要 Go 和 Node.js）
./bin/agent-server config init  # 初始化：配置 LLM 提供商与 API Key

./bin/agent-server chat         # 交互式终端对话
./bin/agent-server serve        # HTTP 服务 + Web 界面（默认 :8080）
```
