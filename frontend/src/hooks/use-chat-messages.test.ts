import { describe, expect, it } from "vitest"
import { fromBackendMessages } from "./use-chat-messages"
import { encodeFileBlock } from "@/lib/attachments"

describe("fromBackendMessages", () => {
  it("parses user attachments from content_parts and file markers", () => {
    const content = `see this${encodeFileBlock("a.txt", "hello")}`
    const entries = fromBackendMessages([
      {
        role: "user",
        content,
        content_parts: [
          { type: "text", text: content },
          { type: "image_url", image_url: { url: "data:image/png;base64,xx" } },
        ],
      },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].content).toBe("see this")
    expect(entries[0].attachments).toEqual([
      { kind: "image", name: "image-1", dataUrl: "data:image/png;base64,xx" },
      { kind: "text", name: "a.txt", text: "hello" },
    ])
  })

  it("keeps a plain user message without attachments", () => {
    const entries = fromBackendMessages([{ role: "user", content: "hi" }])
    expect(entries[0].content).toBe("hi")
    expect(entries[0].attachments).toBeUndefined()
  })

  it("hides tool-image user turns and attaches preview to the tool call", () => {
    const entries = fromBackendMessages([
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "c1",
            name: "read_image",
            arguments: { path: "a.png" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "c1",
        name: "read_image",
        content: JSON.stringify({
          path: "a.png",
          media_type: "image/png",
          bytes: 12,
        }),
      },
      {
        role: "user",
        content: "[image from tool read_image]",
        content_parts: [
          { type: "text", text: "[image from tool read_image]" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,xx" },
          },
        ],
      },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].role).toBe("assistant")
    expect(entries[0].toolCalls?.[0].output).toMatchObject({
      path: "a.png",
      data_url: "data:image/png;base64,xx",
    })
  })
})
