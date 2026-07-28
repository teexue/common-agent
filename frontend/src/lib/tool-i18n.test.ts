import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"

describe("toolDisplayName", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
  })

  it("returns localized label for known tools", () => {
    expect(toolDisplayName("read_file")).toBe("读取文件")
    expect(toolDisplayName("knowledge_search")).toBe("知识库检索")
  })

  it("falls back to raw name for unknown tools", () => {
    expect(toolDisplayName("mcp_custom_tool")).toBe("mcp_custom_tool")
  })

  it("switches with language", async () => {
    await i18n.changeLanguage("en")
    expect(toolDisplayName("read_file")).toBe("Read file")
  })
})

describe("toolDisplayDescription", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
  })

  it("returns localized description when available", () => {
    expect(toolDisplayDescription("echo", "fallback")).toBe("回显传入的消息。")
  })

  it("falls back to provided description for unknown tools", () => {
    expect(toolDisplayDescription("mcp_x", "Custom tool")).toBe("Custom tool")
  })
})
