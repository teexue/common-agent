import { useEffect, useMemo, useRef, useReducer } from "react"
import { chatReducer } from "./use-chat-state"
import { useChatSend, useChatSessionOps } from "./use-chat-actions"
import { dispatchSSEEvent } from "./chat-sse"

const INITIAL_CHAT = {
  messages: [],
  isStreaming: false,
  error: null,
  sessionId: null,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  contextWindow: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
}

export { dispatchSSEEvent }

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef(state.sessionId)
  useEffect(() => {
    sessionIdRef.current = state.sessionId
  }, [state.sessionId])
  const sendMessage = useChatSend(dispatch, abortRef, sessionIdRef)
  const session = useChatSessionOps(dispatch, abortRef)
  return useMemo(
    () => ({ ...state, sendMessage, ...session }),
    [state, sendMessage, session]
  )
}
