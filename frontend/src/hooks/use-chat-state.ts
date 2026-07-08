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

// ─── Helpers ──────────────────────────────────────────────────────

function matchesToolCall(
  tc: ToolCallEntry,
  toolName: string,
  toolCallId?: string
): boolean {
  if (toolCallId && tc.toolCallId) {
    return tc.toolCallId === toolCallId
  }
  return tc.name === toolName
}

/** Update a message entry by id with a transform function. */
function updateMessage(
  messages: ConversationEntry[],
  entryId: string,
  fn: (m: ConversationEntry) => ConversationEntry
): ConversationEntry[] {
  return messages.map((m) => (m.id === entryId ? fn(m) : m))
}

/** Update a tool call within a message by matching name/id.
 *  First tries the entry with matching entryId, then falls back to searching all messages. */
function updateToolCall(
  messages: ConversationEntry[],
  entryId: string,
  toolName: string,
  toolCallId: string | undefined,
  fn: (tc: ToolCallEntry) => ToolCallEntry
): ConversationEntry[] {
  // Try the specified entry first
  const target = messages.find((m) => m.id === entryId)
  if (target?.toolCalls?.some((tc) => matchesToolCall(tc, toolName, toolCallId))) {
    return updateMessage(messages, entryId, (m) => ({
      ...m,
      toolCalls: m.toolCalls?.map((tc) =>
        matchesToolCall(tc, toolName, toolCallId) ? fn(tc) : tc
      ),
    }))
  }
  // Fallback: search all messages
  return messages.map((m) => ({
    ...m,
    toolCalls: m.toolCalls?.map((tc) =>
      matchesToolCall(tc, toolName, toolCallId) ? fn(tc) : tc
    ),
  }))
}

function createUserEntry(text: string): ConversationEntry {
  return { id: `user-${Date.now()}`, role: "user", content: text, timestamp: Date.now() }
}

function createAssistantEntry(entryId: string): ConversationEntry {
  return {
    id: entryId, role: "assistant", content: "", reasoningContent: "",
    toolCalls: [], timestamp: Date.now(), isStreaming: true,
  }
}

function createCompactionEntry(summary: string): ConversationEntry {
  return {
    id: `compaction-${Date.now()}`, role: "system", content: "",
    compactionSummary: summary, timestamp: Date.now(),
  }
}

// ─── Reducer ──────────────────────────────────────────────────────

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return { ...state, messages: [...state.messages, createUserEntry(action.text)], error: null }
    case "START_ASSISTANT":
      return { ...state, messages: [...state.messages, createAssistantEntry(action.entryId)], isStreaming: true }
    case "APPEND_TEXT":
    case "APPEND_REASONING":
      return reduceContentUpdate(state, action)
    case "TOOL_START":
    case "TOOL_RESULT":
    case "TOOL_DENIED":
    case "TOOL_APPROVAL_REQUIRED":
      return reduceToolAction(state, action)
    case "COMPACTION":
      return { ...state, messages: [...state.messages, createCompactionEntry(action.summary)] }
    case "SUB_AGENT_START":
    case "SUB_AGENT_END":
      return reduceSubAgentAction(state, action)
    case "STREAM_DONE":
    case "STREAM_ERROR":
    case "CLEAR":
    case "SET_SESSION_ID":
    case "LOAD_SESSION":
      return reduceSessionAction(state, action)
    default:
      return state
  }
}

// ─── Sub-reducers ─────────────────────────────────────────────────

/** Handles APPEND_TEXT and APPEND_REASONING. */
function reduceContentUpdate(
  state: ChatState,
  action: { type: "APPEND_TEXT" | "APPEND_REASONING"; entryId: string; content: string }
): ChatState {
  if (action.type === "APPEND_TEXT") {
    return {
      ...state,
      messages: updateMessage(state.messages, action.entryId, (m) => ({
        ...m,
        content: m.content + action.content,
      })),
    }
  }
  return {
    ...state,
    messages: updateMessage(state.messages, action.entryId, (m) => ({
      ...m,
      reasoningContent: (m.reasoningContent ?? "") + action.content,
    })),
  }
}

/** Handles TOOL_START, TOOL_RESULT, TOOL_DENIED, TOOL_APPROVAL_REQUIRED. */
function reduceToolAction(
  state: ChatState,
  action: ChatAction & { type: `TOOL_${string}` }
): ChatState {
  switch (action.type) {
    case "TOOL_START":
      return {
        ...state,
        messages: updateMessage(state.messages, action.entryId, (m) => ({
          ...m,
          toolCalls: [...(m.toolCalls ?? []), action.toolCall],
        })),
      }
    case "TOOL_RESULT":
      return {
        ...state,
        messages: updateToolCall(
          state.messages,
          action.entryId,
          action.toolName,
          action.toolCallId,
          (tc) => ({ ...tc, output: action.output, status: "completed" as const, endTime: Date.now() })
        ),
      }
    case "TOOL_DENIED":
      return {
        ...state,
        messages: updateToolCall(
          state.messages,
          action.entryId,
          action.toolName,
          action.toolCallId,
          (tc) => ({ ...tc, output: action.output, status: "denied" as const, endTime: Date.now() })
        ),
      }
    case "TOOL_APPROVAL_REQUIRED":
      return {
        ...state,
        messages: updateToolCall(
          state.messages,
          action.entryId,
          action.toolName,
          action.toolCallId,
          (tc) => ({ ...tc, status: "pending_approval" as const, approvalId: action.approvalId })
        ),
      }
    default:
      return state
  }
}

/** Handles SUB_AGENT_START and SUB_AGENT_END. */
function reduceSubAgentAction(
  state: ChatState,
  action: ChatAction & { type: `SUB_AGENT_${string}` }
): ChatState {
  if (action.type === "SUB_AGENT_START") {
    return {
      ...state,
      messages: updateMessage(state.messages, action.entryId, (m) => ({
        ...m,
        toolCalls: [...(m.toolCalls ?? []), action.toolCall],
      })),
    }
  }
  return {
    ...state,
    messages: updateToolCall(
      state.messages,
      action.entryId,
      action.toolName,
      action.toolCallId,
      (tc) => ({ ...tc, status: "completed" as const, endTime: Date.now() })
    ),
  }
}

/** Handles STREAM_DONE, STREAM_ERROR, CLEAR, SET_SESSION_ID, LOAD_SESSION. */
function reduceSessionAction(
  state: ChatState,
  action: ChatAction & { type: `STREAM_${string}` | "CLEAR" | "SET_SESSION_ID" | "LOAD_SESSION" }
): ChatState {
  switch (action.type) {
    case "STREAM_DONE":
      return {
        ...state,
        isStreaming: false,
        messages: state.messages.map((m) => {
          if (!m.isStreaming) return m
          const isTarget = m.id === action.entryId
          return {
            ...m,
            isStreaming: false,
            usage: isTarget && (action.inputTokens || action.outputTokens)
              ? { inputTokens: action.inputTokens ?? 0, outputTokens: action.outputTokens ?? 0 }
              : m.usage,
          }
        }),
      }
    case "STREAM_ERROR":
      return { ...state, isStreaming: false, error: action.message }
    case "CLEAR":
      return { messages: [], isStreaming: false, error: null, sessionId: null }
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId }
    case "LOAD_SESSION":
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
        isStreaming: false,
        error: null,
      }
    default:
      return state
  }
}
