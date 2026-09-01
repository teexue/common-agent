import type { ChatAction, ChatState } from "./chat-state-types"
import {
  createAssistantEntry,
  createCompactionEntry,
  createUserEntry,
} from "./chat-state-helpers"
import { reduceContentUpdate } from "./chat-reduce-content"
import { reduceSessionAction } from "./chat-reduce-session"
import { reduceSubAgentAction } from "./chat-reduce-subagent"
import { reduceToolAction } from "./chat-reduce-tool"
import { usageFromMetadata } from "./chat-usage"

export type { ChatAction, ChatState } from "./chat-state-types"
export { usageFromMetadata }

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "ADD_USER_MESSAGE") {
    return {
      ...state,
      messages: [
        ...state.messages,
        createUserEntry(action.text, action.attachments),
      ],
      error: null,
    }
  }
  if (action.type === "START_ASSISTANT") {
    return {
      ...state,
      messages: [...state.messages, createAssistantEntry(action.entryId)],
      isStreaming: true,
    }
  }
  if (action.type === "APPEND_TEXT" || action.type === "APPEND_REASONING") {
    return reduceContentUpdate(state, action)
  }
  if (action.type === "COMPACTION") {
    return {
      ...state,
      messages: [...state.messages, createCompactionEntry(action.summary)],
    }
  }
  return reduceByFamily(state, action)
}

function reduceByFamily(state: ChatState, action: ChatAction): ChatState {
  if (action.type.startsWith("TOOL_")) {
    return reduceToolAction(
      state,
      action as ChatAction & { type: `TOOL_${string}` }
    )
  }
  if (action.type.startsWith("SUB_AGENT_")) {
    return reduceSubAgentAction(
      state,
      action as ChatAction & { type: `SUB_AGENT_${string}` }
    )
  }
  return reduceSessionAction(
    state,
    action as ChatAction & {
      type:
        | `STREAM_${string}`
        | "CLEAR"
        | "SET_SESSION_ID"
        | "LOAD_SESSION"
        | "LOAD_LIVE"
    }
  )
}
