import { describe, expect, it } from "vitest"
import { chatReducer } from "./use-chat-state"
import type { ChatState } from "./chat-state-types"
import type { ToolCallEntry } from "@/types/agent"

function empty(): ChatState {
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
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
  }
}

function queuedCall(id = "call-1"): ToolCallEntry {
  return {
    id: "tc-1",
    toolCallId: id,
    name: "delegate_task",
    input: { task: "summarize" },
    status: "sub_agent_queued",
    queueMax: 2,
  }
}

describe("reduceSubAgentAction", () => {
  it("keeps queued status until the child session starts", () => {
    let state = chatReducer(empty(), {
      type: "START_ASSISTANT",
      entryId: "a1",
    })
    state = chatReducer(state, {
      type: "TOOL_START",
      entryId: "a1",
      toolCall: queuedCall(),
    })
    state = chatReducer(state, {
      type: "SUB_AGENT_START",
      entryId: "a1",
      toolCall: {
        ...queuedCall(),
        id: "sa-q",
        status: "sub_agent_queued",
        queueMax: 2,
      },
    })
    let calls = state.messages.flatMap((m) => m.toolCalls ?? [])
    expect(calls[0].status).toBe("sub_agent_queued")
    expect(calls[0].queueMax).toBe(2)

    state = chatReducer(state, {
      type: "SUB_AGENT_START",
      entryId: "a1",
      toolCall: {
        ...queuedCall(),
        id: "sa-1",
        name: "helper",
        sessionId: "sess-child",
        status: "sub_agent_running",
      },
    })
    calls = state.messages.flatMap((m) => m.toolCalls ?? [])
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe("delegate_task")
    expect(calls[0].sessionId).toBe("sess-child")
    expect(calls[0].status).toBe("sub_agent_running")
  })

  it("matches parallel delegates by toolCallId", () => {
    let state = chatReducer(empty(), {
      type: "START_ASSISTANT",
      entryId: "a1",
    })
    state = chatReducer(state, {
      type: "TOOL_START",
      entryId: "a1",
      toolCall: { ...queuedCall("call-a"), id: "tc-a" },
    })
    state = chatReducer(state, {
      type: "TOOL_START",
      entryId: "a1",
      toolCall: { ...queuedCall("call-b"), id: "tc-b", input: { task: "b" } },
    })
    state = chatReducer(state, {
      type: "SUB_AGENT_START",
      entryId: "a1",
      toolCall: {
        ...queuedCall("call-b"),
        id: "sa-b",
        sessionId: "sess-b",
        status: "sub_agent_running",
      },
    })
    const calls = state.messages.flatMap((m) => m.toolCalls ?? [])
    expect(calls.find((c) => c.toolCallId === "call-a")?.status).toBe(
      "sub_agent_queued"
    )
    expect(calls.find((c) => c.toolCallId === "call-b")?.sessionId).toBe(
      "sess-b"
    )
    expect(calls.find((c) => c.toolCallId === "call-b")?.status).toBe(
      "sub_agent_running"
    )
  })
})
