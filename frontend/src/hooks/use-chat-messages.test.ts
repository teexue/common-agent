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
})
