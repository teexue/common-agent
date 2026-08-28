import { beforeEach, describe, expect, it } from "vitest"
import i18n from "@/i18n"
import { extractInputSummaryText, formatToolGroupSummary } from "./tool-summary"
import type { ToolCallEntry } from "@/types/agent"

function tc(name: string, input: unknown, id = name): ToolCallEntry {
  return {
    id,
    name,
    input,
    status: "completed",
  }
}

describe("tool group summary", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
  })

  it("extractInputSummaryText names the file or command", () => {
    expect(
      extractInputSummaryText("read_file", { path: "/Users/me/src/foo.ts" })
    ).toBe("src/foo.ts")
    expect(
      extractInputSummaryText("run_command", {
        command: "go test ./core/loop/",
      })
    ).toBe("$ go test ./core/loop/")
    expect(
      extractInputSummaryText("edit_file", {
        path: "a.go",
        old_string: "a\n",
        new_string: "a\nb\n",
      })
    ).toBe("a.go +1")
    expect(extractInputSummaryText("read_file", '{"path":"pkg/x.go"}')).toBe(
      "pkg/x.go"
    )
  })

  it("formatToolGroupSummary lists tool + operation", () => {
    const text = formatToolGroupSummary(
      [
        tc("read_file", { path: "src/a.ts" }, "1"),
        tc("read_file", { path: "src/b.ts" }, "2"),
        tc(
          "edit_file",
          {
            path: "src/b.ts",
            old_string: "x",
            new_string: "y",
          },
          "3"
        ),
        tc("run_command", { command: "go test" }, "4"),
      ],
      i18n.t.bind(i18n)
    )
    expect(text).toContain("读取文件")
    expect(text).toContain("src/a.ts")
    expect(text).toContain("src/b.ts")
    expect(text).toContain("编辑文件")
    expect(text).toContain("运行命令")
    expect(text).toContain("$ go test")
  })

  it("formatToolGroupSummary groups consecutive same tools", () => {
    const text = formatToolGroupSummary(
      [
        tc("read_file", { path: "a.ts" }, "1"),
        tc("read_file", { path: "b.ts" }, "2"),
        tc("read_file", { path: "c.ts" }, "3"),
      ],
      i18n.t.bind(i18n)
    )
    expect(text).toBe("读取文件 a.ts, b.ts, c.ts")
  })
})
