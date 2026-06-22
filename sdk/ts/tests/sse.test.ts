import { describe, it, expect } from "vitest"
import { parseSSELine } from "../src/sse.js"

describe("parseSSELine", () => {
  it("returns null for non-data lines", () => {
    expect(parseSSELine("event: message")).toBeNull()
    expect(parseSSELine("")).toBeNull()
    expect(parseSSELine("data:")).toBeNull() // missing space after colon
    expect(parseSSELine("retry: 3000")).toBeNull()
  })

  it("parses valid SSE data", () => {
    const event = parseSSELine('data: {"type":"text_delta","content":"hello"}')
    expect(event).toEqual({ type: "text_delta", content: "hello" })
  })

  it("returns null for invalid JSON", () => {
    expect(parseSSELine("data: {invalid json}")).toBeNull()
  })

  it("parses done event", () => {
    const event = parseSSELine('data: {"type":"done","status":"completed","turns":2}')
    expect(event).toEqual({ type: "done", status: "completed", turns: 2 })
  })

  it("parses tool_start event", () => {
    const event = parseSSELine(
      'data: {"type":"tool_start","tool":"echo","input":{"text":"hi"},"tool_call_id":"tc1"}',
    )
    expect(event).toEqual({
      type: "tool_start",
      tool: "echo",
      input: { text: "hi" },
      tool_call_id: "tc1",
    })
  })

  it("parses error event", () => {
    const event = parseSSELine('data: {"type":"error","code":"run_error","message":"something failed"}')
    expect(event).toEqual({
      type: "error",
      code: "run_error",
      message: "something failed",
    })
  })

  it("parses tool_approval_required event", () => {
    const event = parseSSELine(
      'data: {"type":"tool_approval_required","tool":"dangerous","approval_id":"ap1"}',
    )
    expect(event).toEqual({
      type: "tool_approval_required",
      tool: "dangerous",
      approval_id: "ap1",
    })
  })
})
