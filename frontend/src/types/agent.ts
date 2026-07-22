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
  type: string // "openai" | "anthropic"
  base_url: string
  default_model: string
  vision: boolean
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

export interface JobSchedule {
  type: "cron" | "interval" | "once"
  cron?: string
  interval?: string
  at?: string
}

export interface JobInfo {
  id: string
  name: string
  enabled: boolean
  agent: string
  prompt: string
  workdir?: string
  schedule: JobSchedule
  session_mode: "new_each_run" | "continue"
  session_id?: string
  policy: {
    max_runs: number
    timeout?: string
    overlap: "skip" | "queue"
  }
  status: {
    next_run_at?: string
    last_run_at?: string
    last_status?: string
    last_error?: string
    run_count: number
    running?: boolean
  }
  created_at: string
  updated_at: string
}

export interface JobRunRecord {
  id: string
  job_id: string
  session_id?: string
  status: string
  error?: string
  started_at: string
  ended_at: string
}

// Session replay types (mirrors Go audit.EventRecord)

export interface ReplayEvent {
  ts: string
  session_id: string
  agent: string
  turn: number
  event: AgentEvent
}
