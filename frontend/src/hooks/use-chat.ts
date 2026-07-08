import { useCallback, useRef, useReducer } from "react"
import { chatReducer } from "./use-chat-state"
import type { ChatAction } from "./use-chat-state"
import {
  toBackendMessages,
  fromBackendMessages,
  parseSSELine,
} from "./use-chat-messages"
import type { BackendMsg } from "./use-chat-messages"
import type { AgentEvent, ToolCallEntry } from "@/types/agent"

// ─── SSE stream processing ────────────────────────────────────────

async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  entryId: string,
  dispatch: (action: ChatAction) => void
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const event = parseSSELine(trimmed)
      if (!event) continue

      if (dispatchSSEEvent(event, entryId, dispatch)) return
    }
  }

  // Stream ended without a done event
  dispatch({ type: "STREAM_DONE", entryId, status: "completed", turns: 0 })
}

function makeToolCall(event: AgentEvent, prefix: string): ToolCallEntry {
  return {
    id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toolCallId: event.tool_call_id,
    name: event.tool ?? (prefix === "sa" ? "sub-agent" : "unknown"),
    input: event.input ?? event.content ?? "",
    status: prefix === "sa" ? "sub_agent_running" : "running",
    startTime: Date.now(),
  }
}

function isDeniedOutput(output: unknown): boolean {
  if (!output || typeof output !== "object" || !("error" in output)) return false
  const err = (output as Record<string, unknown>).error
  return err === "permission denied" || err === "tool requires approval" || err === "tool approval denied"
}

/** Dispatches a single SSE event. Returns true if the stream should terminate. */
function dispatchSSEEvent(
  event: AgentEvent,
  entryId: string,
  dispatch: (action: ChatAction) => void
): boolean {
  switch (event.type) {
    case "text_delta":
      if (event.content) dispatch({ type: "APPEND_TEXT", entryId, content: event.content })
      return false
    case "reasoning_delta":
      if (event.content) dispatch({ type: "APPEND_REASONING", entryId, content: event.content })
      return false
    case "tool_start":
      dispatch({ type: "TOOL_START", entryId, toolCall: makeToolCall(event, "tc") })
      return false
    case "tool_result":
      dispatch({
        type: isDeniedOutput(event.output) ? "TOOL_DENIED" : "TOOL_RESULT",
        entryId, toolName: event.tool ?? "unknown", toolCallId: event.tool_call_id, output: event.output,
      })
      return false
    case "tool_approval_required":
      dispatch({
        type: "TOOL_APPROVAL_REQUIRED", entryId, toolName: event.tool ?? "unknown",
        toolCallId: event.tool_call_id, approvalId: event.approval_id,
      })
      return false
    case "compaction":
      if (event.content) dispatch({ type: "COMPACTION", summary: event.content })
      return false
    case "sub_agent_start":
      dispatch({ type: "SUB_AGENT_START", entryId, toolCall: makeToolCall(event, "sa") })
      return false
    case "sub_agent_end":
      dispatch({ type: "SUB_AGENT_END", entryId, toolName: event.tool ?? "sub-agent", toolCallId: event.tool_call_id })
      return false
    case "error":
      dispatch({ type: "STREAM_ERROR", message: event.message ?? "Unknown error" })
      return true
    case "done":
      if (event.session_id) {
        dispatch({ type: "SET_SESSION_ID", sessionId: event.session_id })
      }
      dispatch({
        type: "STREAM_DONE", entryId, status: event.status ?? "completed",
        turns: event.turns ?? 0, inputTokens: event.input_tokens, outputTokens: event.output_tokens,
      })
      return true
    default:
      return false
  }
}

async function sendRunRequest(
  agent: string,
  prompt: string,
  messages: BackendMsg[],
  sessionId: string | null,
  workDir: string | undefined,
  signal: AbortSignal,
  entryId: string,
  dispatch: (action: ChatAction) => void,
) {
  const body: Record<string, unknown> = { agent, prompt, messages }
  if (sessionId) body.session_id = sessionId
  if (workDir) body.workdir = workDir

  const res = await fetch("/v1/agents/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.message ?? `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  await processSSEStream(reader, entryId, dispatch)
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isStreaming: false,
    error: null,
    sessionId: null,
  })

  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(state.messages); messagesRef.current = state.messages
  const sessionIdRef = useRef(state.sessionId); sessionIdRef.current = state.sessionId

  const sendMessage = useCallback(
    async (text: string, agent: string, workDir?: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const history = toBackendMessages(messagesRef.current)
      dispatch({ type: "ADD_USER_MESSAGE", text })

      const entryId = `assistant-${Date.now()}`
      dispatch({ type: "START_ASSISTANT", entryId })

      try {
        await sendRunRequest(agent, text, history, sessionIdRef.current, workDir, controller.signal, entryId, dispatch)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        dispatch({ type: "STREAM_ERROR", message: err instanceof Error ? err.message : "Unknown error" })
      }
    },
    []
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: "STREAM_DONE", entryId: "", status: "cancelled", turns: 0 })
  }, [])

  const clear = useCallback(() => {
    abort()
    dispatch({ type: "CLEAR" })
  }, [abort])

  const loadSession = useCallback(
    async (sessionId: string, messages: BackendMsg[]) => {
      abort()
      const entries = fromBackendMessages(messages)
      dispatch({ type: "LOAD_SESSION", sessionId, messages: entries })
    },
    [abort]
  )

  const setSessionId = useCallback((sessionId: string | null) => {
    dispatch({ type: "SET_SESSION_ID", sessionId })
  }, [])

  return { ...state, sendMessage, abort, clear, loadSession, setSessionId }
}
