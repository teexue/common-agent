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
  }
}

function runningCall(): ToolCallEntry {
  return {
    id: "tc-1",
    toolCallId: "call-1",
    name: "delegate_task",
    input: { task: "summarize" },
    status: "sub_agent_running",
  }
}

describe("reduceSubAgentAction", () => {
  it("merges sub_agent_start onto the existing delegate card", () => {
    let state = chatReducer(empty(), {
      type: "START_ASSISTANT",
      entryId: "a1",
    })
    state = chatReducer(state, {
      type: "TOOL_START",
      entryId: "a1",
      toolCall: runningCall(),
    })
    state = chatReducer(state, {
      type: "SUB_AGENT_START",
      entryId: "a1",
      toolCall: {
        ...runningCall(),
        id: "sa-1",
        name: "helper",
        sessionId: "sess-child",
      },
    })
    const calls = state.messages.flatMap((m) => m.toolCalls ?? [])
    expect(calls).toHaveLength(1)
    expect(calls?.[0].name).toBe("delegate_task")
    expect(calls?.[0].sessionId).toBe("sess-child")
  })
})
