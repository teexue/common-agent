import { useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTokenCount, cacheHitPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface SessionTokenUsage {
  inputTokens: number
  outputTokens: number
  contextWindow: number
  cacheReadTokens?: number
}

interface TokenUsageIndicatorProps {
  usage: SessionTokenUsage
}

const RING_SIZE = 18
const RING_STROKE = 2.5
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * Compact token usage gauge: a small ring showing how much of the model's
 * context window the current session has consumed, with totals in the
 * largest unit (M > K). Hover for the input/output breakdown.
 */
export function TokenUsageIndicator({ usage }: TokenUsageIndicatorProps) {
  const { t } = useTranslation()
  const { inputTokens, outputTokens, contextWindow } = usage
  if (contextWindow <= 0) return null

  const used = inputTokens + outputTokens
  const ratio = Math.min(used / contextWindow, 1)
  const percent = Math.round(ratio * 100)
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio)
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
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className={cn("shrink-0", tone)}
              aria-hidden
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </svg>
            <span className="font-mono text-[11px] tabular-nums">
              {formatTokenCount(used)}
              <span className="mx-0.5 text-muted-foreground/50">/</span>
              {formatTokenCount(contextWindow)}
            </span>
          </button>
        }
      />
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <div>
            {t("conversation.tokenUsageTooltip", {
              input: formatTokenCount(inputTokens),
              output: formatTokenCount(outputTokens),
              window: formatTokenCount(contextWindow),
              percent,
            })}
          </div>
          {usage.cacheReadTokens != null && usage.cacheReadTokens > 0 && (
            <div className="flex items-center gap-1.5 border-t border-background/15 pt-1.5 text-[11px] font-medium text-success-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full bg-success-foreground"
                aria-hidden
              />
              {t("conversation.cacheHitTooltip", {
                cached: formatTokenCount(usage.cacheReadTokens),
                pct: cacheHitPercent(usage.cacheReadTokens, inputTokens),
              })}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
