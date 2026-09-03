import type { ChatState } from "./chat-state-types"

const META_LAST_INPUT = "usage.input_tokens"
const META_LAST_OUTPUT = "usage.output_tokens"
const META_LAST_CACHE_READ = "usage.last_cache_read_tokens"
const META_LAST_CACHE_CREATION = "usage.last_cache_creation_tokens"
const META_CACHE_READ = "usage.cache_read_tokens"
const META_CACHE_CREATION = "usage.cache_creation_tokens"
const META_CONTEXT_WINDOW = "usage.context_window"
const META_TOTAL_INPUT = "usage.total_input_tokens"
const META_TOTAL_OUTPUT = "usage.total_output_tokens"

function parseMetaInt(v: string | undefined): number {
  const n = v === undefined ? NaN : Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Extracts the latest request's token usage from persisted session metadata. */
export function usageFromMetadata(
  metadata?: Record<string, string>
): Pick<
  ChatState,
  | "inputTokens"
  | "outputTokens"
  | "cacheReadTokens"
  | "cacheCreationTokens"
  | "contextWindow"
  | "totalInputTokens"
  | "totalOutputTokens"
  | "totalCacheReadTokens"
  | "totalCacheCreationTokens"
> {
  return {
    inputTokens: parseMetaInt(metadata?.[META_LAST_INPUT]),
    outputTokens: parseMetaInt(metadata?.[META_LAST_OUTPUT]),
    cacheReadTokens: parseMetaInt(metadata?.[META_LAST_CACHE_READ]),
    cacheCreationTokens: parseMetaInt(metadata?.[META_LAST_CACHE_CREATION]),
    contextWindow: parseMetaInt(metadata?.[META_CONTEXT_WINDOW]),
    totalInputTokens: parseMetaInt(metadata?.[META_TOTAL_INPUT]),
    totalOutputTokens: parseMetaInt(metadata?.[META_TOTAL_OUTPUT]),
    totalCacheReadTokens: parseMetaInt(metadata?.[META_CACHE_READ]),
    totalCacheCreationTokens: parseMetaInt(metadata?.[META_CACHE_CREATION]),
  }
}
