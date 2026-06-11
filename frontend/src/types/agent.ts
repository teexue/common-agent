// Domain types mirroring Go backend structs
// See: core/event/event.go, server/http/server.go

export type EventType =
  | "text_delta"
  | "reasoning_delta"
  | "tool_start"
  | "tool_result"
  | "error"
  | "done"

export interface AgentEvent {
  type: EventType
  content?: string // text_delta, reasoning_delta
  tool?: string // tool_start, tool_result
  input?: unknown // tool_start (json.RawMessage)
  output?: unknown // tool_result (json.RawMessage)
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

export interface ScenarioInfo {
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
  name: string
  input: unknown
  output?: unknown
  status: "pending" | "running" | "completed" | "error"
  startTime?: number
  endTime?: number
}

export type StreamStatus = "idle" | "streaming" | "error" | "done"
