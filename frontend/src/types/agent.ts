export type EventType =
  | "text_delta"
  | "reasoning_delta"
  | "user_prompt"
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
  context_window?: number // done: effective model context window
  cache_read_input_tokens?: number // done: prompt cache hits across the run
  cache_creation_input_tokens?: number // done: prompt cache writes across the run
  total_input_tokens?: number // done: cumulative input across all turns of the run
  total_output_tokens?: number // done: cumulative output across all turns of the run
  truncated?: boolean // done: last completion hit max output tokens
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
  max_turns?: number
  context_window?: number
  contextWindow?: number
  systemPrompt?: string
}

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
  compaction?: CompactionConfig
}

export interface CompactionConfig {
  strategy?: string
  context_window?: number
  trigger_ratio?: number
  keep_recent?: number
  max_messages?: number
}

export interface OptimizeConfig {
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

export type FileAttachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "text"; name: string; text: string }

export interface ConversationEntry {
  id: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  reasoningContent?: string
  toolCalls?: ToolCallEntry[]
  timestamp: number
  isStreaming?: boolean
  compactionSummary?: string
  /** Last completion hit the max output token limit. */
  outputTruncated?: boolean
  usage?: TokenUsage
  attachments?: FileAttachment[]
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
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
  sessionId?: string
}

export type StreamStatus = "idle" | "streaming" | "error" | "done"

export interface SessionMeta {
  id: string
  agent: string
  title?: string
  metadata?: Record<string, string>
  created_at: string
  updated_at: string
  /** True when a run is known to be in progress (set by the workspace). */
  running?: boolean
}

export interface ProviderInfo {
  name: string
  api_style: "openai" | "anthropic" | "ollama"
  auth_style?: "x-api-key" | "bearer"
  display_name: string
  base_url: string
  default_model: string
  models?: string[]
  models_path: string
  vision: boolean
  api_key_env?: string
  model_windows?: Record<string, number>
  context_window?: number
}

export interface VendorInfo {
  name: string
  display_name: string
  openai_base_url: string
  anthropic_base_url?: string
  anthropic_auth?: "x-api-key" | "bearer"
  default_model: string
  api_key_env: string
  api_version?: string
  api_style: "openai" | "anthropic" | "ollama"
  supported_styles: ("openai" | "anthropic" | "ollama")[]
  vision: boolean
  supports_thinking: boolean
}

export interface ModelInfo {
  id: string
  vision?: boolean
  context_window?: number
}

/** Returned by providers that can introspect a model (e.g. Ollama /api/show). */
export interface ModelDetail {
  id: string
  context_window?: number
  runtime_context_window?: number
  architecture?: string
  family?: string
  families?: string[]
  parameter_size?: string
  quantization?: string
  capabilities?: string[]
}

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

export interface SkillDetail extends SkillInfo {
  body: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowed_tools?: string
}

export interface MCPServerInfo {
  name: string
  type: string // "stdio" | "sse"
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  agent: string // agent name for agent-scoped servers; "" for global
  scope: "global" | "agent"
}

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

/** One audited LLM request/response pair. */
export interface RequestLogRecord {
  ts: string
  session_id?: string
  agent?: string
  source?: string
  model?: string
  duration_ms: number
  request?: unknown
  response?: unknown
  error?: string
  input_tokens?: number
  output_tokens?: number
}

export interface UsageTotals {
  requests: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
}

export interface UsageDay extends UsageTotals {
  date: string
}

export interface UsageModelRow extends UsageTotals {
  model: string
}

export interface UsageSessionRow extends UsageTotals {
  session_id: string
  agent?: string
}

export interface UsageSummary {
  total: UsageTotals
  days: UsageDay[]
  by_model: UsageModelRow[]
  by_session: UsageSessionRow[]
}
