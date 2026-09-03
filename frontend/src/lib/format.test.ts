import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import {
  formatParameterSize,
  formatRelativeTime,
  formatTimestamp,
  formatTokenCount,
} from "@/lib/format"

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

  it("formatTokenCount prefers the largest unit", () => {
    expect(formatTokenCount(0)).toBe("0")
    expect(formatTokenCount(123)).toBe("123")
    expect(formatTokenCount(1_234)).toBe("1.2K")
    expect(formatTokenCount(12_345)).toBe("12.3K")
    expect(formatTokenCount(123_456)).toBe("123K")
    expect(formatTokenCount(1_234_567)).toBe("1.2M")
    expect(formatTokenCount(12_345_678)).toBe("12.3M")
    expect(formatTokenCount(123_456_789)).toBe("123M")
    expect(formatTokenCount(128_000)).toBe("128K")
    expect(formatTokenCount(1_000_000)).toBe("1.0M")
  })

  it("formatParameterSize turns raw counts into B/M labels", () => {
    expect(formatParameterSize("321323031390")).toBe("321B")
    expect(formatParameterSize("8000000000")).toBe("8B")
    expect(formatParameterSize("3B")).toBe("3B")
    expect(formatParameterSize("8x7B")).toBe("8x7B")
    expect(formatParameterSize("")).toBe("")
  })
})
