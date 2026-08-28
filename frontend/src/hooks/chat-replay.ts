import type { ConversationEntry } from "@/types/agent"
import type { ReplayEvent } from "@/types/agent"
import { chatReducer } from "./use-chat-state"
import type { ChatState } from "./use-chat-state"
import { dispatchSSEEvent } from "./use-chat"
import type { BackendMsg } from "./use-chat-messages"

const initialChatState: ChatState = {
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

/** Folds recorded run events into chat-style conversation entries, reusing
 * the same reducer as the live chat view so both render identically. */
export function eventsToEntries(
  records: ReplayEvent[],
  prompt?: string
): ConversationEntry[] {
  let state: ChatState = { ...initialChatState }
  if (prompt) {
    state = chatReducer(state, { type: "ADD_USER_MESSAGE", text: prompt })
  }
  const entryId = "assistant-replay"
  state = chatReducer(state, { type: "START_ASSISTANT", entryId })
  for (const rec of records) {
    dispatchSSEEvent(rec.event, entryId, (action) => {
      state = chatReducer(state, action)
    })
  }
  // Reassign deterministic ids: the reducer mints Date.now()-based ids, which
  // change on every poll rebuild and remount the components (collapsing any
  // user-expanded thinking/tool blocks). Positional ids stay stable as long
  // as events are append-only.
  return state.messages.map((m, i) => ({
    ...m,
    id: `replay-entry-${i}`,
    toolCalls: m.toolCalls?.map((tc, j) => ({
      ...tc,
      id: `replay-tc-${i}-${j}`,
    })),
  }))
}

/** A run is in progress when there are recorded events but none of the
 * terminal events (done/error) appears after the last `done`. Equivalently:
 * the last event is neither `done` nor `error`. */
export function isRunInProgress(records: ReplayEvent[]): boolean {
  if (records.length === 0) return false
  const last = records[records.length - 1]?.event?.type
  return last !== "done" && last !== "error"
}

/** Extracts the last user-role message content from persisted backend
 * messages, used as the prompt label for a live replay view. */
export function lastUserPrompt(messages: BackendMsg[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content
  }
  return undefined
}
