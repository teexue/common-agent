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
}

export interface ToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface AgentInfo {
  name: string
  provider: string
  model: string
  tools: string[]
  maxTurns: number
  systemPrompt?: string
}

// Full agent detail (from GET /v1/agents/:name)
export interface AgentDetail {
  name: string
  provider: string
  model: string
  system_prompt: string
  tools: string[]
  max_turns: number
  max_tokens: number
  tool_execution?: ToolExecutionConfig
  permissions?: PermissionsConfig
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
  metadata?: Record<string, string>
  created_at: string
  updated_at: string
}

// Provider info types (mirrors Go provider.ProviderInfo)

export interface ProviderInfo {
  name: string
  type: string // "openai" | "anthropic"
  base_url: string
  default_model: string
}

// Skill info (mirrors Go SkillInfo)
export interface SkillInfo {
  name: string
  version: string
  description: string
  format: string // "skill.md" | "skill.yaml"
  author?: string
  tools: string[]
}

// MCP server info (mirrors Go MCPServerInfo)
export interface MCPServerInfo {
  name: string
  type: string // "stdio" | "sse"
  command?: string
  url?: string
  agent: string
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

// Session replay types (mirrors Go audit.EventRecord)

export interface ReplayEvent {
  ts: string
  session_id: string
  agent: string
  turn: number
  event: AgentEvent
}
