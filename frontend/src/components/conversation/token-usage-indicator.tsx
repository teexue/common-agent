import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTokenCount } from "@/lib/format"
import { promptTokenCount } from "@/lib/token-usage"
import { TokenUsageRing } from "./token-usage-ring"
import { TokenUsageTooltipBody } from "./token-usage-tooltip"

export interface SessionTokenUsage {
  inputTokens: number
  outputTokens: number
  contextWindow: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  totalInputTokens?: number
  totalOutputTokens?: number
  totalCacheReadTokens?: number
  totalCacheCreationTokens?: number
}

function fillTone(ratio: number): string {
  if (ratio >= 0.9) return "text-destructive"
  if (ratio >= 0.7) return "text-warning"
  return "text-primary"
}

/**
 * Compact gauge: last request vs the model context window. Cache tokens
 * that Anthropic reports exclusive of input_tokens are included in the fill.
 */
export function TokenUsageIndicator({ usage }: { usage: SessionTokenUsage }) {
  const { inputTokens, outputTokens, contextWindow } = usage
  if (contextWindow <= 0) return null
  const prompt = promptTokenCount(
    inputTokens,
    usage.cacheReadTokens ?? 0,
    usage.cacheCreationTokens ?? 0
  )
  const used = prompt + outputTokens
  const ratio = Math.min(used / contextWindow, 1)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-lg px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <TokenUsageRing ratio={ratio} tone={fillTone(ratio)} />
            <span className="font-mono text-[11px] tabular-nums">
              {formatTokenCount(used)}
              <span className="mx-0.5 text-muted-foreground/50">/</span>
              {formatTokenCount(contextWindow)}
            </span>
          </button>
        }
      />
      <TooltipContent>
        <TokenUsageTooltipBody
          usage={usage}
          percent={Math.round(ratio * 100)}
        />
      </TooltipContent>
    </Tooltip>
  )
}
