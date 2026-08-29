import type { ChatState } from "./chat-state-types"
import { updateMessage } from "./chat-state-helpers"

function appendFields(
  action: { type: "APPEND_TEXT" | "APPEND_REASONING"; content: string },
  content: string,
  reasoning: string | undefined
): { content: string; reasoningContent: string | undefined } {
  return {
    content: action.type === "APPEND_TEXT" ? content + action.content : content,
    reasoningContent:
      action.type === "APPEND_REASONING"
        ? (reasoning ?? "") + action.content
        : reasoning,
  }
}

function appendToLast(
  state: ChatState,
  last: ChatState["messages"][number],
  action: {
    type: "APPEND_TEXT" | "APPEND_REASONING"
    content: string
  }
): ChatState {
  return {
    ...state,
    messages: updateMessage(state.messages, last.id, (m) => ({
      ...m,
      ...appendFields(action, m.content, m.reasoningContent),
    })),
  }
}

function startNewTextEntry(
  state: ChatState,
  action: {
    type: "APPEND_TEXT" | "APPEND_REASONING"
    content: string
  }
): ChatState {
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

/** Handles APPEND_TEXT and APPEND_REASONING.
 * After tool calls the stream continues on a new text entry; otherwise
 * it appends to the current streaming assistant message. */
export function reduceContentUpdate(
  state: ChatState,
  action: {
    type: "APPEND_TEXT" | "APPEND_REASONING"
    entryId: string
    content: string
  }
): ChatState {
  const lastEntry = state.messages[state.messages.length - 1]
  if (
    lastEntry?.role === "assistant" &&
    lastEntry.isStreaming &&
    (!lastEntry.toolCalls || lastEntry.toolCalls.length === 0)
  ) {
    return appendToLast(state, lastEntry, action)
  }
  if (lastEntry?.toolCalls && lastEntry.toolCalls.length > 0) {
    return startNewTextEntry(state, action)
  }
  return {
    ...state,
    messages: updateMessage(state.messages, action.entryId, (m) => ({
      ...m,
      ...appendFields(action, m.content, m.reasoningContent),
    })),
  }
}
