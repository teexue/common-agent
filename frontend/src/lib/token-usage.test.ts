import { describe, expect, it } from "vitest"
import {
  cacheHitPercent,
  promptTokenCount,
  splitUsageParts,
} from "./token-usage"

describe("token usage math", () => {
  it("treats Anthropic cache as extra prompt tokens", () => {
    expect(promptTokenCount(302, 57_500, 100)).toBe(57_902)
    expect(cacheHitPercent(57_500, 302, 100)).toBe(99)
  })

  it("treats OpenAI cache as a subset of input", () => {
    expect(promptTokenCount(900, 700)).toBe(900)
    expect(cacheHitPercent(700, 900)).toBe(78)
    expect(cacheHitPercent(250, 250)).toBe(100)
  })

  it("returns 0 hit rate without cache or prompt", () => {
    expect(cacheHitPercent(0, 302)).toBe(0)
    expect(cacheHitPercent(100, 0)).toBe(100)
    expect(cacheHitPercent(0, 0)).toBe(0)
  })

  it("splits Anthropic aggregates without double-counting", () => {
    const parts = splitUsageParts({
      requests: 1,
      input_tokens: 50,
      output_tokens: 20,
      cache_read_tokens: 1000,
      cache_creation_tokens: 100,
    })
    expect(parts.exclusiveCache).toBe(true)
    expect(parts.freshInput).toBe(50)
    expect(parts.cacheRead).toBe(1000)
    expect(parts.prompt).toBe(1150)
    expect(parts.processed).toBe(1170)
  })

  it("splits OpenAI aggregates with cache inside input", () => {
    const parts = splitUsageParts({
      requests: 1,
      input_tokens: 900,
      output_tokens: 40,
      cache_read_tokens: 700,
      cache_creation_tokens: 0,
    })
    expect(parts.exclusiveCache).toBe(false)
    expect(parts.freshInput).toBe(200)
    expect(parts.cacheRead).toBe(700)
    expect(parts.prompt).toBe(900)
    expect(parts.processed).toBe(940)
  })
})
