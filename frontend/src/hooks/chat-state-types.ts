import type { ConversationEntry, ToolCallEntry } from "@/types/agent"

export interface ChatState {
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
  sessionId: string | null
  /** Token usage of the most recent LLM request (overwritten each run). */
  inputTokens: number
  outputTokens: number
  /** Cumulative prompt cache hits/writes across the session (0 until reported). */
  cacheReadTokens: number
  cacheCreationTokens: number
  /** Effective model context window in tokens (0 until known). */
  contextWindow: number
  /** Cumulative input/output tokens across every run of this session. */
  totalInputTokens: number
  totalOutputTokens: number
}

export type ChatAction =
  | { type: "ADD_USER_MESSAGE"; text: string }
  | { type: "START_ASSISTANT"; entryId: string }
  | { type: "APPEND_TEXT"; entryId: string; content: string }
  | { type: "APPEND_REASONING"; entryId: string; content: string }
  | { type: "TOOL_START"; entryId: string; toolCall: ToolCallEntry }
  | {
      type: "TOOL_RESULT"
      entryId: string
      toolName: string
      toolCallId?: string
      output: unknown
    }
  | {
      type: "TOOL_DENIED"
      entryId: string
      toolName: string
      toolCallId?: string
      output: unknown
    }
  | {
      type: "TOOL_APPROVAL_REQUIRED"
      entryId: string
      toolName: string
      toolCallId?: string
      approvalId?: string
    }
  | { type: "COMPACTION"; summary: string }
  | {
      type: "SUB_AGENT_START"
      entryId: string
      toolCall: ToolCallEntry
      sessionId?: string
    }
  | {
      type: "SUB_AGENT_END"
      entryId: string
      toolName: string
      toolCallId?: string
      sessionId?: string
    }
  | {
      type: "STREAM_DONE"
      entryId: string
      status: string
      turns: number
      inputTokens?: number
      outputTokens?: number
      cacheReadTokens?: number
      cacheCreationTokens?: number
      contextWindow?: number
      /** Run-level cumulative usage from the done event; folded into totals. */
      totalInputTokens?: number
      totalOutputTokens?: number
    }
  | { type: "STREAM_ERROR"; message: string }
  | { type: "CLEAR" }
  | { type: "SET_SESSION_ID"; sessionId: string | null }
  | {
      type: "LOAD_SESSION"
      sessionId: string
      messages: ConversationEntry[]
      /** Session metadata from the backend; restores cumulative token usage. */
      metadata?: Record<string, string>
    }
  | {
      type: "LOAD_LIVE"
      sessionId: string
      messages: ConversationEntry[]
      metadata?: Record<string, string>
    }
