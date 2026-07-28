import { describe, expect, it } from "vitest"

import { addedLines, diffLines } from "./diff-utils"

describe("diffLines", () => {
  it("marks unchanged lines as ctx with dual line numbers", () => {
    const lines = diffLines("a\nb", "a\nb")
    expect(lines).toEqual([
      { type: "ctx", text: "a", oldNo: 1, newNo: 1 },
      { type: "ctx", text: "b", oldNo: 2, newNo: 2 },
    ])
  })

  it("marks replacements as del followed by add", () => {
    const lines = diffLines("a\nb\nc", "a\nx\nc")
    expect(lines.map((l) => l.type)).toEqual(["ctx", "del", "add", "ctx"])
    expect(lines[1]).toMatchObject({ text: "b", oldNo: 2 })
    expect(lines[2]).toMatchObject({ text: "x", newNo: 2 })
  })

  it("marks pure insertions as add", () => {
    const lines = diffLines("a", "a\nb")
    expect(lines).toEqual([
      { type: "ctx", text: "a", oldNo: 1, newNo: 1 },
      { type: "add", text: "b", newNo: 2 },
    ])
  })

  it("marks pure deletions as del", () => {
    const lines = diffLines("a\nb", "a")
    expect(lines).toEqual([
      { type: "ctx", text: "a", oldNo: 1, newNo: 1 },
      { type: "del", text: "b", oldNo: 2 },
    ])
  })

  it("handles empty old text as all additions", () => {
    expect(diffLines("", "x\ny")).toEqual(addedLines("x\ny"))
  })
})

describe("addedLines", () => {
  it("marks every line as an addition with new line numbers", () => {
    expect(addedLines("one\ntwo")).toEqual([
      { type: "add", text: "one", newNo: 1 },
      { type: "add", text: "two", newNo: 2 },
    ])
  })

  it("returns empty for empty text", () => {
    expect(addedLines("")).toEqual([])
  })
})
