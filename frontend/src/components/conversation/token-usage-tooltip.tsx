import { useTranslation } from "react-i18next"
import { formatTokenCount, cacheHitPercent } from "@/lib/format"
import type { SessionTokenUsage } from "./token-usage-indicator"

export function TokenUsageTooltipBody({
  usage,
  percent,
}: {
  usage: SessionTokenUsage
  percent: number
}) {
  const { t } = useTranslation()
  const sessionTotal =
    (usage.totalInputTokens ?? 0) + (usage.totalOutputTokens ?? 0)
  return (
    <div className="flex flex-col gap-1">
      <div>
        {t("conversation.tokenUsageTooltip", {
          input: formatTokenCount(usage.inputTokens),
          output: formatTokenCount(usage.outputTokens),
          window: formatTokenCount(usage.contextWindow),
          percent,
        })}
      </div>
      {sessionTotal > 0 && (
        <div className="border-t border-background/15 pt-1.5 text-[11px]">
          {t("conversation.sessionTotalTooltip", {
            total: formatTokenCount(sessionTotal),
          })}
        </div>
      )}
      {usage.cacheReadTokens != null && usage.cacheReadTokens > 0 && (
        <div className="flex items-center gap-1.5 border-t border-background/15 pt-1.5 text-[11px] font-medium text-success-foreground">
          <span
            className="size-1.5 shrink-0 rounded-full bg-success-foreground"
            aria-hidden
          />
          {t("conversation.cacheHitTooltip", {
            cached: formatTokenCount(usage.cacheReadTokens),
            pct: cacheHitPercent(usage.cacheReadTokens, usage.inputTokens),
          })}
        </div>
      )}
    </div>
  )
}
