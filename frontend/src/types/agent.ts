// Domain types mirroring Go backend structs
// See: core/event/event.go, server/http/server.go

export type EventType =
  | "text_delta"
  | "reasoning_delta"
  | "tool_start"
  | "tool_result"
  | "tool_approval_required"
  | "compaction"
  | "sub_agent_start"
  | "sub_agent_end"
  | "error"
  | "done"

export interface AgentEvent {
  type: EventType
  content?: string // text_delta, reasoning_delta, compaction, sub_agent_start
  tool?: string // tool_start, tool_result, sub_agent_start, sub_agent_end
  input?: unknown // tool_start (json.RawMessage)
  output?: unknown // tool_result (json.RawMessage)
  tool_call_id?: string // tool_start, tool_result, tool_approval_required
  approval_id?: string // tool_approval_required
  code?: string // error
  message?: string // error
  status?: string // done: "completed" | "failed" | "cancelled"
  turns?: number // done
  input_tokens?: number // done
  output_tokens?: number // done
  session_id?: string // done
}

export interface ToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface AgentInfo {
  id: string
  name: string
  provider: string
  model: string
  tools: string[]
  maxTurns: number
  systemPrompt?: string
}

// Full agent detail (from GET /v1/agents/:id)
export interface AgentDetail {
  id: string
  name: string
  provider: string
  model: string
  system_prompt: string
  tools: string[]
  max_turns: number
  max_tokens: number
  tool_execution?: ToolExecutionConfig
  permissions?: PermissionsConfig
  mcp_servers?: McpServerConfig[]
  knowledge?: KnowledgeConfig
  optimize?: OptimizeConfig
}

export interface OptimizeConfig {
  system_prompt?: boolean
  user_prompt?: boolean
}

export interface KnowledgeConfig {
  bases?: string[]
  top_k?: number
}

export interface KnowledgeMeta {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  doc_count: number
  chunk_count: number
}

export interface KnowledgeDocument {
  id: string
  filename: string
  size: number
  created_at: string
  chunk_count: number
}

export interface KnowledgeHit {
  kb_id: string
  doc_id: string
  filename: string
  chunk_index: number
  text: string
  score: number
}

export interface EmbeddingConfig {
  vendor?: string
  backend: "openai" | "ollama" | string
  base_url?: string
  api_key_env?: string
  model: string
  dimensions?: number
  has_api_key?: boolean
}

export interface EmbeddingVendorInfo {
  name: string
  display_name: string
  backend: string
  base_url: string
  api_key_env?: string
  default_model: string
  models?: string[]
  default_dimensions?: number
  dimensions?: number[]
  max_batch?: number
}

export interface McpServerConfig {
  name: string
  type: "stdio" | "sse"
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

export interface ToolExecutionConfig {
  Mode: string
  MaxParallel: number
}

export interface PermissionsConfig {
  auto_approve?: string[]
  always_deny?: string[]
}

// Frontend-only: accumulated conversation state

export interface ConversationEntry {
  id: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  reasoningContent?: string
  toolCalls?: ToolCallEntry[]
  timestamp: number
  isStreaming?: boolean
  compactionSummary?: string
  usage?: TokenUsage
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface ToolCallEntry {
  id: string
  toolCallId?: string // backend tool call ID (correlates events across the stream)
  approvalId?: string // approval ID used for interactive approval
  name: string
  input: unknown
  output?: unknown
  status:
    | "pending"
    | "running"
    | "completed"
    | "error"
    | "denied"
    | "pending_approval"
    | "sub_agent_running"
  startTime?: number
  endTime?: number
}

export type StreamStatus = "idle" | "streaming" | "error" | "done"

// Session persistence types (mirrors Go session.SessionMeta)

export interface SessionMeta {
  id: string
  agent: string
  title?: string
  metadata?: Record<string, string>
  created_at: string
  updated_at: string
}

// Provider info types (mirrors Go provider.ProviderInfo)

export interface ProviderInfo {
  name: string
  api_style: "openai" | "anthropic"
  auth_style?: "x-api-key" | "bearer"
  display_name: string
  base_url: string
  default_model: string
  models_path: string
  vision: boolean
}

// Built-in vendor preset (mirrors Go provider.VendorInfo)
export interface VendorInfo {
  name: string
  display_name: string
  openai_base_url: string
  anthropic_base_url?: string
  anthropic_auth?: "x-api-key" | "bearer"
  default_model: string
  api_key_env: string
  api_version?: string
  api_style: "openai" | "anthropic"
  supported_styles: ("openai" | "anthropic")[]
  vision: boolean
  supports_thinking: boolean
}

// Model list entry (mirrors Go provider.ModelInfo)
export interface ModelInfo {
  id: string
  vision?: boolean
  context_window?: number
}

// Skill info (mirrors Go SkillInfo)
export interface SkillInfo {
  name: string
  version: string
  description: string
  format: string // "skill.md" | "skill.yaml"
  scope: "global" | "agent"
  agent?: string // agent name for agent-scoped skills
  author?: string
  tools: string[]
}

// Skill detail (SkillInfo + full body and frontmatter fields)
export interface SkillDetail extends SkillInfo {
  body: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowed_tools?: string
}

// MCP server info (mirrors Go MCPServerInfo)
export interface MCPServerInfo {
  name: string
  type: string // "stdio" | "sse"
  command?: string
  url?: string
  agent: string // agent name for agent-scoped servers; "" for global
  scope: "global" | "agent"
}

// Health & metrics types (mirrors Go telemetry)

export interface AgentStatsView {
  runs: number
  total_ms: number
  avg_ms: number
  last_run: string
  last_status: string
}

export interface MetricsData {
  goroutines: number
  heap_alloc_bytes: number
  heap_sys_bytes: number
  active_sessions: number
  uptime_seconds: number
  agents?: Record<string, AgentStatsView>
}

export interface ComponentHealth {
  name: string
  status: "up" | "down"
  error: string
}

export interface HealthStatus {
  status: "up" | "down"
  details?: ComponentHealth[]
}

// Kanban task item (mirrors Go kanban item struct)

export type KanbanStatus = "pending" | "running" | "review" | "done" | "failed"

export interface KanbanItem {
  id: string
  user_id: string
  title: string
  prompt: string
  agent: string
  workdir?: string
  status: KanbanStatus
  priority: number // 1=low 2=medium 3=high
  tags: string[]
  due_at?: string
  feedback?: string
  result?: string
  session_id?: string
  attempts: number
  created_at: string
  updated_at: string
  finished_at?: string
}

// Session replay types (mirrors Go audit.EventRecord)

export interface ReplayEvent {
  ts: string
  session_id: string
  agent: string
  turn: number
  event: AgentEvent
}
