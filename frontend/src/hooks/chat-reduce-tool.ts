import type { ChatAction, ChatState } from "./chat-state-types"
import { updateMessage, updateToolCall } from "./chat-state-helpers"

function reduceToolStart(
  state: ChatState,
  action: ChatAction & { type: "TOOL_START" }
): ChatState {
  const closed = state.messages.map((m) =>
    m.id === action.entryId && m.isStreaming ? { ...m, isStreaming: false } : m
  )
  const lastEntry = closed[closed.length - 1]
  if (lastEntry?.toolCalls && lastEntry.toolCalls.length > 0) {
    return {
      ...state,
      messages: updateMessage(closed, lastEntry.id, (m) => ({
        ...m,
        toolCalls: [...(m.toolCalls ?? []), action.toolCall],
      })),
    }
  }
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

function patchTool(
  state: ChatState,
  action: {
    entryId: string
    toolName: string
    toolCallId?: string
    output?: unknown
    approvalId?: string
  },
  status: "completed" | "denied" | "pending_approval"
): ChatState {
  return {
    ...state,
    messages: updateToolCall(
      state.messages,
      action.entryId,
      action.toolName,
      action.toolCallId,
      (tc) => ({
        ...tc,
        ...(status === "pending_approval"
          ? { status, approvalId: action.approvalId }
          : { output: action.output, status, endTime: Date.now() }),
      })
    ),
  }
}

/** Handles TOOL_START, TOOL_RESULT, TOOL_DENIED, TOOL_APPROVAL_REQUIRED. */
export function reduceToolAction(
  state: ChatState,
  action: ChatAction & { type: `TOOL_${string}` }
): ChatState {
  switch (action.type) {
    case "TOOL_START":
      return reduceToolStart(state, action)
    case "TOOL_RESULT":
      return patchTool(state, action, "completed")
    case "TOOL_DENIED":
      return patchTool(state, action, "denied")
    case "TOOL_APPROVAL_REQUIRED":
      return patchTool(state, action, "pending_approval")
    default:
      return state
  }
}
