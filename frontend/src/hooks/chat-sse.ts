import type { AgentEvent, ToolCallEntry } from "@/types/agent"
import type { ChatAction } from "./use-chat-state"

type Dispatch = (action: ChatAction) => void
type Handler = (
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
) => boolean

function makeToolCall(event: AgentEvent, prefix: string): ToolCallEntry {
  return {
    id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toolCallId: event.tool_call_id,
    name: event.tool ?? (prefix === "sa" ? "sub-agent" : "unknown"),
    input: event.input ?? event.content ?? "",
    status:
      prefix === "sa" || event.tool === "delegate_task"
        ? "sub_agent_running"
        : "running",
    startTime: Date.now(),
    sessionId: event.session_id,
  }
}

function isDeniedOutput(output: unknown): boolean {
  if (!output || typeof output !== "object" || Array.isArray(output))
    return false
  const rec = output as Record<string, unknown>
  if (rec.status === "user_rejected") return true
  const err = rec.error
  return (
    err === "permission denied" ||
    err === "tool requires approval" ||
    err === "tool approval denied"
  )
}

function handleTextDelta(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  if (event.content)
    dispatch({ type: "APPEND_TEXT", entryId, content: event.content })
  return false
}

function handleReasoningDelta(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  if (event.content)
    dispatch({ type: "APPEND_REASONING", entryId, content: event.content })
  return false
}

function handleToolStart(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({ type: "TOOL_START", entryId, toolCall: makeToolCall(event, "tc") })
  return false
}

function handleToolResult(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({
    type: isDeniedOutput(event.output) ? "TOOL_DENIED" : "TOOL_RESULT",
    entryId,
    toolName: event.tool ?? "unknown",
    toolCallId: event.tool_call_id,
    output: event.output,
  })
  return false
}

function handleToolApproval(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({
    type: "TOOL_APPROVAL_REQUIRED",
    entryId,
    toolName: event.tool ?? "unknown",
    toolCallId: event.tool_call_id,
    approvalId: event.approval_id,
  })
  return false
}

function handleCompaction(
  event: AgentEvent,
  _entryId: string,
  dispatch: Dispatch
): boolean {
  if (event.content) dispatch({ type: "COMPACTION", summary: event.content })
  return false
}

function handleSubAgentStart(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({
    type: "SUB_AGENT_START",
    entryId,
    toolCall: makeToolCall(event, "sa"),
  })
  return false
}

function handleSubAgentEnd(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({
    type: "SUB_AGENT_END",
    entryId,
    toolName: event.tool ?? "sub-agent",
    toolCallId: event.tool_call_id,
    sessionId: event.session_id,
  })
  return false
}

function handleError(
  event: AgentEvent,
  _entryId: string,
  dispatch: Dispatch
): boolean {
  dispatch({
    type: "STREAM_ERROR",
    message: event.message ?? "Unknown error",
  })
  return true
}

function handleDone(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  if (event.session_id) {
    dispatch({ type: "SET_SESSION_ID", sessionId: event.session_id })
  }
  dispatch({
    type: "STREAM_DONE",
    entryId,
    status: event.status ?? "completed",
    turns: event.turns ?? 0,
    inputTokens: event.input_tokens,
    outputTokens: event.output_tokens,
    cacheReadTokens: event.cache_read_input_tokens,
    cacheCreationTokens: event.cache_creation_input_tokens,
    contextWindow: event.context_window,
    totalInputTokens: event.total_input_tokens,
    totalOutputTokens: event.total_output_tokens,
    truncated: event.truncated,
  })
  return true
}

const HANDLERS: Record<string, Handler> = {
  text_delta: handleTextDelta,
  reasoning_delta: handleReasoningDelta,
  tool_start: handleToolStart,
  tool_result: handleToolResult,
  tool_approval_required: handleToolApproval,
  compaction: handleCompaction,
  sub_agent_start: handleSubAgentStart,
  sub_agent_end: handleSubAgentEnd,
  error: handleError,
  done: handleDone,
}

/** Dispatches a single SSE event. Returns true if the stream should terminate. */
export function dispatchSSEEvent(
  event: AgentEvent,
  entryId: string,
  dispatch: Dispatch
): boolean {
  const handler = HANDLERS[event.type]
  return handler ? handler(event, entryId, dispatch) : false
}

export function handledSSETypes(): string[] {
  return Object.keys(HANDLERS).sort()
}
