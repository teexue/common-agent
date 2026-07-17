import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { formatRelativeTime, formatTimestamp } from "@/lib/format"

describe("format i18n", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
  })

  it("formatRelativeTime uses zh-CN strings", () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe("刚刚")
    const fiveMin = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMin.toISOString())).toBe("5 分钟前")
  })

  it("formatRelativeTime switches with language", async () => {
    await i18n.changeLanguage("en")
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe("just now")
    const fiveMin = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMin.toISOString())).toBe("5 min ago")
  })

  it("formatTimestamp returns a non-empty time string", () => {
    const s = formatTimestamp(Date.now())
    expect(s.length).toBeGreaterThan(0)
  })
})
