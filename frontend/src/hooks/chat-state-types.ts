import type { ConversationEntry, ToolCallEntry } from "@/types/agent"

// ─── State ────────────────────────────────────────────────────────

export interface ChatState {
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
  sessionId: string | null
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
  | { type: "SUB_AGENT_START"; entryId: string; toolCall: ToolCallEntry }
  | {
      type: "SUB_AGENT_END"
      entryId: string
      toolName: string
      toolCallId?: string
    }
  | {
      type: "STREAM_DONE"
      entryId: string
      status: string
      turns: number
      inputTokens?: number
      outputTokens?: number
    }
  | { type: "STREAM_ERROR"; message: string }
  | { type: "CLEAR" }
  | { type: "SET_SESSION_ID"; sessionId: string | null }
  | { type: "LOAD_SESSION"; sessionId: string; messages: ConversationEntry[] }
