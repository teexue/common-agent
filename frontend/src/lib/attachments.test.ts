import { describe, expect, it } from "vitest"
import {
  buildSendPrompt,
  encodeFileBlock,
  imagesFromAttachments,
  isImageFile,
  isTextFile,
  parseFileBlocks,
  parseUserContent,
  readFiles,
  sanitizeFileName,
} from "./attachments"
import type { FileAttachment } from "@/types/agent"

describe("sanitizeFileName", () => {
  it("strips newlines and fence markers", () => {
    expect(sanitizeFileName("a>>>b\nc")).toBe("ab c")
  })
})

describe("file blocks", () => {
  it("round-trips a text file in the prompt", () => {
    const block = encodeFileBlock("notes.md", "# hi\nworld")
    const parsed = parseFileBlocks(`please read${block}`)
    expect(parsed.text).toBe("please read")
    expect(parsed.files).toEqual([
      { kind: "text", name: "notes.md", text: "# hi\nworld" },
    ])
  })

  it("handles multiple files", () => {
    const prompt = `q${encodeFileBlock("a.txt", "A")}${encodeFileBlock("b.txt", "B")}`
    const parsed = parseFileBlocks(prompt)
    expect(parsed.text).toBe("q")
    expect(parsed.files).toHaveLength(2)
    expect(parsed.files[0].name).toBe("a.txt")
    expect(parsed.files[1].text).toBe("B")
  })
})

describe("buildSendPrompt", () => {
  it("appends text files and leaves images out of the prompt", () => {
    const attachments: FileAttachment[] = [
      { kind: "text", name: "a.txt", text: "hello" },
      { kind: "image", name: "p.png", dataUrl: "data:image/png;base64,xx" },
    ]
    expect(buildSendPrompt("look", attachments)).toBe(
      `look${encodeFileBlock("a.txt", "hello")}`
    )
  })

  it("sends a space when only images are attached", () => {
    const attachments: FileAttachment[] = [
      { kind: "image", name: "p.png", dataUrl: "data:image/png;base64,xx" },
    ]
    expect(buildSendPrompt("", attachments)).toBe(" ")
  })
})

describe("imagesFromAttachments", () => {
  it("returns undefined when there are no images", () => {
    expect(imagesFromAttachments([])).toBeUndefined()
    expect(
      imagesFromAttachments([{ kind: "text", name: "a.txt", text: "x" }])
    ).toBeUndefined()
  })

  it("maps image attachments for the run API", () => {
    expect(
      imagesFromAttachments([
        { kind: "image", name: "p.png", dataUrl: "data:x" },
      ])
    ).toEqual([{ dataUrl: "data:x", name: "p.png" }])
  })
})

describe("parseUserContent", () => {
  it("restores images from content_parts and files from the prompt", () => {
    const content = `check this${encodeFileBlock("a.txt", "body")}`
    const result = parseUserContent(content, [
      { type: "text", text: content },
      { type: "image_url", image_url: { url: "data:image/png;base64,xx" } },
    ])
    expect(result.text).toBe("check this")
    expect(result.attachments).toEqual([
      { kind: "image", name: "image-1", dataUrl: "data:image/png;base64,xx" },
      { kind: "text", name: "a.txt", text: "body" },
    ])
  })
})

describe("file kind", () => {
  it("detects images by MIME type", () => {
    expect(isImageFile(new File([], "a.png", { type: "image/png" }))).toBe(true)
    expect(isImageFile(new File([], "a.txt", { type: "text/plain" }))).toBe(
      false
    )
  })

  it("detects text by MIME type or extension", () => {
    expect(isTextFile(new File([], "a.go", { type: "" }))).toBe(true)
    expect(
      isTextFile(new File([], "a.json", { type: "application/json" }))
    ).toBe(true)
    expect(
      isTextFile(new File([], "a.bin", { type: "application/octet-stream" }))
    ).toBe(false)
  })
})

describe("readFiles", () => {
  it("reads a text file and rejects unsupported binaries", async () => {
    const result = await readFiles([
      new File(["hello"], "note.txt", { type: "text/plain" }),
      new File([new Uint8Array([1, 2, 3])], "x.bin", {
        type: "application/octet-stream",
      }),
    ])
    expect(result.ok).toEqual([
      { kind: "text", name: "note.txt", text: "hello" },
    ])
    expect(result.errors).toEqual([{ code: "unsupported", name: "x.bin" }])
  })
})
