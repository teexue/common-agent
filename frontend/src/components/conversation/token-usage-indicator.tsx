import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTokenCount } from "@/lib/format"
import { TokenUsageRing } from "./token-usage-ring"
import { TokenUsageTooltipBody } from "./token-usage-tooltip"

export interface SessionTokenUsage {
  inputTokens: number
  outputTokens: number
  contextWindow: number
  cacheReadTokens?: number
  /** Cumulative usage across every run of the session (optional legacy). */
  totalInputTokens?: number
  totalOutputTokens?: number
}

/**
 * Compact token usage gauge: a small ring showing how much of the model's
 * context window the most recent LLM request consumed, with totals in the
 * largest unit (M > K). Hover for the input/output breakdown.
 */
export function TokenUsageIndicator({ usage }: { usage: SessionTokenUsage }) {
  const { inputTokens, outputTokens, contextWindow } = usage
  if (contextWindow <= 0) return null
  const used = inputTokens + outputTokens
  const ratio = Math.min(used / contextWindow, 1)
  const tone =
    ratio >= 0.9
      ? "text-destructive"
      : ratio >= 0.7
        ? "text-warning"
        : "text-primary"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-lg px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <TokenUsageRing ratio={ratio} tone={tone} />
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
