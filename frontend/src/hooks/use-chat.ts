import { useCallback, useRef, useReducer } from "react"
import type { AgentEvent, ConversationEntry, ToolCallEntry } from "@/types/agent"

// ─── Message conversion (frontend → backend) ─────────────────────

interface BackendMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  reasoning_content?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
  name?: string
}

function toBackendMessages(entries: ConversationEntry[]): BackendMessage[] {
  const msgs: BackendMessage[] = []

  for (const entry of entries) {
    if (entry.role === "user") {
      msgs.push({ role: "user", content: entry.content })
    }

    if (entry.role === "assistant") {
      // If there are tool calls, emit the assistant message with tool_calls
      if (entry.toolCalls && entry.toolCalls.length > 0) {
        msgs.push({
          role: "assistant",
          content: entry.content || "",
          reasoning_content: entry.reasoningContent || undefined,
          tool_calls: entry.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.input ?? {},
          })),
        })
        // Then emit tool results
        for (const tc of entry.toolCalls) {
          if (tc.status === "completed" && tc.output !== undefined) {
            msgs.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.name,
              content: typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output),
            })
          }
        }
      } else if (entry.content) {
        msgs.push({
          role: "assistant",
          content: entry.content,
          reasoning_content: entry.reasoningContent || undefined,
        })
      }
    }
  }

  return msgs
}

// ─── State ────────────────────────────────────────────────────────

interface ChatState {
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
}

type ChatAction =
  | { type: "ADD_USER_MESSAGE"; text: string }
  | { type: "START_ASSISTANT"; entryId: string }
  | { type: "APPEND_TEXT"; entryId: string; content: string }
  | { type: "APPEND_REASONING"; entryId: string; content: string }
  | { type: "TOOL_START"; entryId: string; toolCall: ToolCallEntry }
  | { type: "TOOL_RESULT"; entryId: string; toolName: string; output: unknown }
  | { type: "STREAM_DONE"; entryId: string; status: string; turns: number }
  | { type: "STREAM_ERROR"; message: string }
  | { type: "CLEAR" }

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE": {
      const userEntry: ConversationEntry = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action.text,
        timestamp: Date.now(),
      }
      return { ...state, messages: [...state.messages, userEntry], error: null }
    }

    case "START_ASSISTANT": {
      const assistantEntry: ConversationEntry = {
        id: action.entryId,
        role: "assistant",
        content: "",
        reasoningContent: "",
        toolCalls: [],
        timestamp: Date.now(),
        isStreaming: true,
      }
      return { ...state, messages: [...state.messages, assistantEntry], isStreaming: true }
    }

    case "APPEND_TEXT": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.entryId
            ? { ...m, content: m.content + action.content }
            : m
        ),
      }
    }

    case "APPEND_REASONING": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.entryId
            ? { ...m, reasoningContent: (m.reasoningContent ?? "") + action.content }
            : m
        ),
      }
    }

    case "TOOL_START": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.entryId
            ? { ...m, toolCalls: [...(m.toolCalls ?? []), action.toolCall] }
            : m
        ),
      }
    }

    case "TOOL_RESULT": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.entryId
            ? {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.name === action.toolName
                    ? { ...tc, output: action.output, status: "completed" as const, endTime: Date.now() }
                    : tc
                ),
              }
            : m
        ),
      }
    }

    case "STREAM_DONE": {
      return {
        ...state,
        isStreaming: false,
        messages: state.messages.map((m) =>
          m.id === action.entryId ? { ...m, isStreaming: false } : m
        ),
      }
    }

    case "STREAM_ERROR": {
      return { ...state, isStreaming: false, error: action.message }
    }

    case "CLEAR": {
      return { messages: [], isStreaming: false, error: null }
    }

    default:
      return state
  }
}

// ─── SSE Parser ───────────────────────────────────────────────────

function parseSSELine(line: string): AgentEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as AgentEvent
  } catch {
    return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isStreaming: false,
    error: null,
  })

  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(state.messages)
  messagesRef.current = state.messages

  const sendMessage = useCallback(
    async (text: string, scenario: string) => {
      // Abort any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Build history BEFORE dispatching the new user message
      const history = toBackendMessages(messagesRef.current)

      dispatch({ type: "ADD_USER_MESSAGE", text })

      const entryId = `assistant-${Date.now()}`
      dispatch({ type: "START_ASSISTANT", entryId })

      try {
        const res = await fetch("/v1/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, prompt: text, messages: history }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => null)
          throw new Error(errBody?.message ?? `HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

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

            switch (event.type) {
              case "text_delta":
                if (event.content) {
                  dispatch({ type: "APPEND_TEXT", entryId, content: event.content })
                }
                break

              case "reasoning_delta":
                if (event.content) {
                  dispatch({ type: "APPEND_REASONING", entryId, content: event.content })
                }
                break

              case "tool_start":
                dispatch({
                  type: "TOOL_START",
                  entryId,
                  toolCall: {
                    id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: event.tool ?? "unknown",
                    input: event.input,
                    status: "running",
                    startTime: Date.now(),
                  },
                })
                break

              case "tool_result":
                dispatch({
                  type: "TOOL_RESULT",
                  entryId,
                  toolName: event.tool ?? "unknown",
                  output: event.output,
                })
                break

              case "error":
                dispatch({ type: "STREAM_ERROR", message: event.message ?? "Unknown error" })
                return

              case "done":
                dispatch({
                  type: "STREAM_DONE",
                  entryId,
                  status: event.status ?? "completed",
                  turns: event.turns ?? 0,
                })
                return
            }
          }
        }

        // Stream ended without a done event
        dispatch({ type: "STREAM_DONE", entryId, status: "completed", turns: 0 })
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        dispatch({
          type: "STREAM_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        })
      }
    },
    []
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const clear = useCallback(() => {
    abort()
    dispatch({ type: "CLEAR" })
  }, [abort])

  return { ...state, sendMessage, abort, clear }
}
