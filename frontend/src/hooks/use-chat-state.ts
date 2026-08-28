import type { ChatAction, ChatState } from "./chat-state-types"
import {
  createAssistantEntry,
  createCompactionEntry,
  createUserEntry,
  updateMessage,
  updateToolCall,
} from "./chat-state-helpers"

export type { ChatAction, ChatState } from "./chat-state-types"

// Metadata keys written by the backend (core/session/session.go). The
// `usage.input_tokens` / `usage.output_tokens` keys hold the MOST RECENT
// single request's usage (written by Session.SetLastUsage); the cache keys
// are cumulative across the session. The token-usage indicator shows the
// latest request's fill against the context window, so it reads the
// per-request keys, not the cumulative totals.
const META_LAST_INPUT = "usage.input_tokens"
const META_LAST_OUTPUT = "usage.output_tokens"
const META_CACHE_READ = "usage.cache_read_tokens"
const META_CACHE_CREATION = "usage.cache_creation_tokens"
const META_CONTEXT_WINDOW = "usage.context_window"

function parseMetaInt(v: string | undefined): number {
  const n = v === undefined ? NaN : Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Extracts the latest request's token usage from persisted session metadata. */
export function usageFromMetadata(
  metadata?: Record<string, string>
): Pick<
  ChatState,
  "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheCreationTokens" | "contextWindow"
> {
  return {
    inputTokens: parseMetaInt(metadata?.[META_LAST_INPUT]),
    outputTokens: parseMetaInt(metadata?.[META_LAST_OUTPUT]),
    cacheReadTokens: parseMetaInt(metadata?.[META_CACHE_READ]),
    cacheCreationTokens: parseMetaInt(metadata?.[META_CACHE_CREATION]),
    contextWindow: parseMetaInt(metadata?.[META_CONTEXT_WINDOW]),
  }
}

// ─── Reducer ──────────────────────────────────────────────────────

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, createUserEntry(action.text)],
        error: null,
      }
    case "START_ASSISTANT":
      return {
        ...state,
        messages: [...state.messages, createAssistantEntry(action.entryId)],
        isStreaming: true,
      }
    case "APPEND_TEXT":
    case "APPEND_REASONING":
      return reduceContentUpdate(state, action)
    case "TOOL_START":
    case "TOOL_RESULT":
    case "TOOL_DENIED":
    case "TOOL_APPROVAL_REQUIRED":
      return reduceToolAction(state, action)
    case "COMPACTION":
      return {
        ...state,
        messages: [...state.messages, createCompactionEntry(action.summary)],
      }
    case "SUB_AGENT_START":
    case "SUB_AGENT_END":
      return reduceSubAgentAction(state, action)
    case "STREAM_DONE":
    case "STREAM_ERROR":
    case "CLEAR":
    case "SET_SESSION_ID":
    case "LOAD_SESSION":
    case "LOAD_LIVE":
      return reduceSessionAction(state, action)
    default:
      return state
  }
}

// ─── Sub-reducers ─────────────────────────────────────────────────

/** Handles APPEND_TEXT and APPEND_REASONING.
 *  Three cases:
 *  1. Last entry is a streaming text entry (text after tools) → append to it
 *  2. Last entry has tool calls → create new text entry below it
 *  3. Otherwise → append to the original entryId */
function reduceContentUpdate(
  state: ChatState,
  action: {
    type: "APPEND_TEXT" | "APPEND_REASONING"
    entryId: string
    content: string
  }
): ChatState {
  const lastEntry = state.messages[state.messages.length - 1]

  // Case 1: last entry is a streaming text entry → append to it
  if (
    lastEntry?.role === "assistant" &&
    lastEntry.isStreaming &&
    (!lastEntry.toolCalls || lastEntry.toolCalls.length === 0)
  ) {
    return {
      ...state,
      messages: updateMessage(state.messages, lastEntry.id, (m) => ({
        ...m,
        content:
          action.type === "APPEND_TEXT"
            ? m.content + action.content
            : m.content,
        reasoningContent:
          action.type === "APPEND_REASONING"
            ? (m.reasoningContent ?? "") + action.content
            : m.reasoningContent,
      })),
    }
  }

  // Case 2: last entry has tool calls → create new text entry
  if (lastEntry?.toolCalls && lastEntry.toolCalls.length > 0) {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: `text-${Date.now()}`,
          role: "assistant" as const,
          content: action.type === "APPEND_TEXT" ? action.content : "",
          reasoningContent:
            action.type === "APPEND_REASONING" ? action.content : "",
          timestamp: Date.now(),
          isStreaming: true,
        },
      ],
    }
  }

  // Case 3: normal append
  return {
    ...state,
    messages: updateMessage(state.messages, action.entryId, (m) => ({
      ...m,
      content:
        action.type === "APPEND_TEXT" ? m.content + action.content : m.content,
      reasoningContent:
        action.type === "APPEND_REASONING"
          ? (m.reasoningContent ?? "") + action.content
          : m.reasoningContent,
    })),
  }
}

/** Handles TOOL_START, TOOL_RESULT, TOOL_DENIED, TOOL_APPROVAL_REQUIRED. */
function reduceToolAction(
  state: ChatState,
  action: ChatAction & { type: `TOOL_${string}` }
): ChatState {
  switch (action.type) {
    case "TOOL_START": {
      // Close streaming on the current text entry
      const closed = state.messages.map((m) =>
        m.id === action.entryId && m.isStreaming
          ? { ...m, isStreaming: false }
          : m
      )
      const lastEntry = closed[closed.length - 1]
      // If last entry already has tool calls, append to it (aggregate)
      if (lastEntry?.toolCalls && lastEntry.toolCalls.length > 0) {
        return {
          ...state,
          messages: updateMessage(closed, lastEntry.id, (m) => ({
            ...m,
            toolCalls: [...(m.toolCalls ?? []), action.toolCall],
          })),
        }
      }
      // Otherwise create new entry for tool call(s)
      return {
        ...state,
        messages: [
          ...closed,
          {
            id: `tc-${Date.now()}`,
            role: "assistant" as const,
            content: "",
            toolCalls: [action.toolCall],
            timestamp: Date.now(),
          },
        ],
      }
    }
    case "TOOL_RESULT":
      return {
        ...state,
        messages: updateToolCall(
          state.messages,
          action.entryId,
          action.toolName,
          action.toolCallId,
          (tc) => ({
            ...tc,
            output: action.output,
            status: "completed" as const,
            endTime: Date.now(),
          })
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
          (tc) => ({
            ...tc,
            output: action.output,
            status: "denied" as const,
            endTime: Date.now(),
          })
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
          (tc) => ({
            ...tc,
            status: "pending_approval" as const,
            approvalId: action.approvalId,
          })
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
  action: ChatAction & {
    type: `STREAM_${string}` | "CLEAR" | "SET_SESSION_ID" | "LOAD_SESSION" | "LOAD_LIVE"
  }
): ChatState {
  switch (action.type) {
    case "STREAM_DONE":
      return {
        ...state,
        isStreaming: false,
        // The indicator shows the LATEST request's fill against the context
        // window, so overwrite (not accumulate) with the values carried by
        // this done event. The "close previous streaming entry" dispatch
        // omits token fields; leave the existing values untouched then.
        inputTokens:
          action.inputTokens != null ? action.inputTokens : state.inputTokens,
        outputTokens:
          action.outputTokens != null
            ? action.outputTokens
            : state.outputTokens,
        cacheReadTokens:
          action.cacheReadTokens != null
            ? action.cacheReadTokens
            : state.cacheReadTokens,
        cacheCreationTokens:
          action.cacheCreationTokens != null
            ? action.cacheCreationTokens
            : state.cacheCreationTokens,
        contextWindow: action.contextWindow ?? state.contextWindow,
        messages: state.messages.map((m) => {
          if (!m.isStreaming) return m
          const isTarget = m.id === action.entryId
          return {
            ...m,
            isStreaming: false,
            usage:
              isTarget && (action.inputTokens || action.outputTokens)
                ? {
                    inputTokens: action.inputTokens ?? 0,
                    outputTokens: action.outputTokens ?? 0,
                    cacheReadTokens: action.cacheReadTokens ?? 0,
                    cacheCreationTokens: action.cacheCreationTokens ?? 0,
                  }
                : m.usage,
          }
        }),
      }
    case "STREAM_ERROR":
      return {
        ...state,
        isStreaming: false,
        error: action.message,
        // Close any message still marked as streaming so the UI never gets
        // stuck on a "generating…" bubble after an error.
        messages: state.messages.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m
        ),
      }
    case "CLEAR":
      return {
        messages: [],
        isStreaming: false,
        error: null,
        sessionId: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        contextWindow: 0,
      }
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId }
    case "LOAD_SESSION":
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
        isStreaming: false,
        error: null,
        ...usageFromMetadata(action.metadata),
      }
    case "LOAD_LIVE":
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
        isStreaming: true,
        error: null,
        ...usageFromMetadata(action.metadata),
      }
    default:
      return state
  }
}
