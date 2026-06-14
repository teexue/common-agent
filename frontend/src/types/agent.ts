// Domain types mirroring Go backend structs
// See: core/event/event.go, server/http/server.go

export type EventType =
  | "text_delta"
  | "reasoning_delta"
  | "tool_start"
  | "tool_result"
  | "tool_approval_required"
  | "error"
  | "done"

export interface AgentEvent {
  type: EventType
  content?: string // text_delta, reasoning_delta
  tool?: string // tool_start, tool_result
  input?: unknown // tool_start (json.RawMessage)
  output?: unknown // tool_result (json.RawMessage)
  tool_call_id?: string // tool_start, tool_result, tool_approval_required
  approval_id?: string // tool_approval_required
  code?: string // error
  message?: string // error
  status?: string // done: "completed" | "failed" | "cancelled"
  turns?: number // done
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

// Frontend-only: accumulated conversation state

export interface ConversationEntry {
  id: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  reasoningContent?: string
  toolCalls?: ToolCallEntry[]
  timestamp: number
  isStreaming?: boolean
}

export interface ToolCallEntry {
  id: string
  toolCallId?: string // backend tool call ID (correlates events across the stream)
  approvalId?: string // approval ID used for interactive approval
  name: string
  input: unknown
  output?: unknown
  status: "pending" | "running" | "completed" | "error" | "denied" | "pending_approval"
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
