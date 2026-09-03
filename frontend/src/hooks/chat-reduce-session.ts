import type { ChatAction, ChatState } from "./chat-state-types"
import { usageFromMetadata } from "./chat-usage"

const EMPTY_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  contextWindow: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
}

function applyStreamUsage(
  state: ChatState,
  action: ChatAction & { type: "STREAM_DONE" }
): Pick<
  ChatState,
  | "inputTokens"
  | "outputTokens"
  | "cacheReadTokens"
  | "cacheCreationTokens"
  | "contextWindow"
  | "totalInputTokens"
  | "totalOutputTokens"
  | "totalCacheReadTokens"
  | "totalCacheCreationTokens"
> {
  return {
    inputTokens:
      action.inputTokens != null ? action.inputTokens : state.inputTokens,
    outputTokens:
      action.outputTokens != null ? action.outputTokens : state.outputTokens,
    cacheReadTokens:
      action.cacheReadTokens != null
        ? action.cacheReadTokens
        : state.cacheReadTokens,
    cacheCreationTokens:
      action.cacheCreationTokens != null
        ? action.cacheCreationTokens
        : state.cacheCreationTokens,
    contextWindow: action.contextWindow ?? state.contextWindow,
    totalInputTokens: state.totalInputTokens + (action.totalInputTokens ?? 0),
    totalOutputTokens:
      state.totalOutputTokens + (action.totalOutputTokens ?? 0),
    totalCacheReadTokens:
      state.totalCacheReadTokens + (action.cacheReadTokens ?? 0),
    totalCacheCreationTokens:
      state.totalCacheCreationTokens + (action.cacheCreationTokens ?? 0),
  }
}

function closeStreaming(
  state: ChatState,
  action: ChatAction & { type: "STREAM_DONE" }
): ChatState["messages"] {
  return state.messages.map((m) => {
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
  })
}

function reduceStreamDone(
  state: ChatState,
  action: ChatAction & { type: "STREAM_DONE" }
): ChatState {
  return {
    ...state,
    isStreaming: false,
    ...applyStreamUsage(state, action),
    messages: closeStreaming(state, action),
  }
}

/** Handles STREAM_DONE, STREAM_ERROR, CLEAR, SET_SESSION_ID, LOAD_SESSION. */
export function reduceSessionAction(
  state: ChatState,
  action: ChatAction & {
    type:
      | `STREAM_${string}`
      | "CLEAR"
      | "SET_SESSION_ID"
      | "LOAD_SESSION"
      | "LOAD_LIVE"
  }
): ChatState {
  switch (action.type) {
    case "STREAM_DONE":
      return reduceStreamDone(state, action)
    case "STREAM_ERROR":
      return {
        ...state,
        isStreaming: false,
        error: action.message,
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
        ...EMPTY_USAGE,
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
