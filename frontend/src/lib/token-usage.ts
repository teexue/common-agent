import type { UsageTotals } from "@/types/agent"

/**
 * Prompt tokens actually processed for one request/aggregate.
 * Anthropic reports cache exclusive of input_tokens; OpenAI includes it.
 * When cache exceeds input we treat cache as extra (Anthropic).
 */
export function promptTokenCount(
  inputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens = 0
): number {
  const cache = cacheReadTokens + cacheCreationTokens
  if (cache > inputTokens) return inputTokens + cache
  return Math.max(inputTokens, 0)
}

/** Percentage of the prompt served from cache. Capped at 100. */
export function cacheHitPercent(
  cacheReadTokens: number,
  inputTokens: number,
  cacheCreationTokens = 0
): number {
  const prompt = promptTokenCount(
    inputTokens,
    cacheReadTokens,
    cacheCreationTokens
  )
  if (prompt <= 0 || cacheReadTokens <= 0) return 0
  return Math.min(100, Math.round((cacheReadTokens / prompt) * 100))
}

export interface UsageParts {
  freshInput: number
  cacheRead: number
  cacheCreation: number
  output: number
  prompt: number
  processed: number
  exclusiveCache: boolean
}

/** Splits an aggregate into bar segments without double-counting cache. */
export function splitUsageParts(t: UsageTotals): UsageParts {
  const exclusive =
    t.cache_read_tokens + t.cache_creation_tokens > t.input_tokens
  const cacheRead = Math.max(0, t.cache_read_tokens)
  const cacheCreation = Math.max(0, t.cache_creation_tokens)
  const freshInput = exclusive
    ? Math.max(0, t.input_tokens)
    : Math.max(0, t.input_tokens - cacheRead)
  const prompt = promptTokenCount(
    t.input_tokens,
    t.cache_read_tokens,
    t.cache_creation_tokens
  )
  return {
    freshInput,
    cacheRead: exclusive ? cacheRead : Math.min(cacheRead, t.input_tokens),
    cacheCreation,
    output: Math.max(0, t.output_tokens),
    prompt,
    processed: prompt + Math.max(0, t.output_tokens),
    exclusiveCache: exclusive,
  }
}
