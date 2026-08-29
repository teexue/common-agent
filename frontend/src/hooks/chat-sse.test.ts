import { describe, expect, it } from "vitest"
import { handledSSETypes } from "./chat-sse"

const GO_EVENT_TYPES = [
  "compaction",
  "done",
  "error",
  "reasoning_delta",
  "sub_agent_end",
  "sub_agent_start",
  "text_delta",
  "tool_approval_required",
  "tool_result",
  "tool_start",
]

describe("handledSSETypes", () => {
  it("covers every core/event.Type", () => {
    expect(handledSSETypes()).toEqual([...GO_EVENT_TYPES].sort())
  })
})
