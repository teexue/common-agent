/**
 * Event types emitted by the agent stream.
 * Mirrors core/event.AllTypes. Adding a Go type requires appending here.
 */
export const ALL_EVENT_TYPES = [
  "text_delta",
  "reasoning_delta",
  "tool_start",
  "tool_result",
  "tool_approval_required",
  "compaction",
  "sub_agent_start",
  "sub_agent_end",
  "error",
  "done",
] as const

export type EventType = (typeof ALL_EVENT_TYPES)[number]

/**
 * A single agent stream event.
 */
export interface AgentEvent {
  type: EventType
  /** Text content for text_delta / reasoning_delta */
  content?: string
  /** Tool name for tool_start / tool_result / tool_approval_required */
  tool?: string
  /** Tool input JSON for tool_start / tool_approval_required */
  input?: unknown
  /** Tool output JSON for tool_result */
  output?: unknown
  /** Tool call ID correlating events across the stream */
  tool_call_id?: string
  /** Approval ID for tool_approval_required */
  approval_id?: string
  /** Error code for error events */
  code?: string
  /** Error message for error events */
  message?: string
  /** Completion status for done events: "completed" | "failed" | "cancelled" */
  status?: string
  /** Turn count for done events */
  turns?: number
  /** True when the last completion hit the max output token limit */
  truncated?: boolean
}

/**
 * Tool information returned by the API.
 */
export interface ToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * Agent list item returned by the API.
 */
export interface AgentListItem {
  name: string
  provider: string
  model: string
  tools: string[]
  max_turns: number
}

/**
 * Full agent details returned by the API.
 */
export interface AgentDetail {
  name: string
  provider: string
  model: string
  system_prompt: string
  tools: string[]
  max_turns: number
  max_tokens: number
}

/**
 * Session metadata.
 */
export interface SessionMeta {
  id: string
  agent: string
  metadata?: Record<string, string>
  created_at: string
  updated_at: string
}

/**
 * Conversation message sent to the API.
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string
}

/**
 * Options for AgentClient.run().
 */
export interface RunOptions {
  /** Agent name to run */
  agent: string
  /** User prompt */
  prompt: string
  /** Optional session ID for resume */
  sessionId?: string
  /** Optional conversation history */
  messages?: Message[]
  /** Override the agent's default model for this run */
  model?: string
  /** Provider name for model; resolved from enabled lists if omitted */
  provider?: string
  /** AbortSignal for cancellation */
  signal?: AbortSignal
}

/**
 * Options for AgentClient constructor.
 */
export interface AgentClientOptions {
  /** Base URL of the agent server (default: http://localhost:8080) */
  baseUrl?: string
  /** Custom fetch implementation (default: global fetch) */
  fetch?: typeof globalThis.fetch
}
