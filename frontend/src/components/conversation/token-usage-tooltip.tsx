import { useTranslation } from "react-i18next"
import { formatTokenCount } from "@/lib/format"
import { cacheHitPercent, promptTokenCount } from "@/lib/token-usage"
import type { SessionTokenUsage } from "./token-usage-indicator"

function TurnLines({
  usage,
  percent,
}: {
  usage: SessionTokenUsage
  percent: number
}) {
  const { t } = useTranslation()
  const cached = usage.cacheReadTokens ?? 0
  const written = usage.cacheCreationTokens ?? 0
  const hit = cacheHitPercent(cached, usage.inputTokens, written)
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground">
        {t("conversation.turnUsageLabel", { percent })}
      </p>
      <p>
        {t("conversation.tokenUsageTooltip", {
          input: formatTokenCount(
            promptTokenCount(usage.inputTokens, cached, written)
          ),
          output: formatTokenCount(usage.outputTokens),
          window: formatTokenCount(usage.contextWindow),
        })}
      </p>
      {cached > 0 && (
        <p className="text-success">
          {t("conversation.cacheHitTooltip", {
            cached: formatTokenCount(cached),
            pct: hit,
          })}
        </p>
      )}
      {written > 0 && (
        <p>
          {t("conversation.cacheWriteTooltip", {
            written: formatTokenCount(written),
          })}
        </p>
      )}
    </div>
  )
}

function SessionLines({ usage }: { usage: SessionTokenUsage }) {
  const { t } = useTranslation()
  const cacheRead = usage.totalCacheReadTokens ?? 0
  const cacheWrite = usage.totalCacheCreationTokens ?? 0
  const prompt = promptTokenCount(
    usage.totalInputTokens ?? 0,
    cacheRead,
    cacheWrite
  )
  const total = prompt + (usage.totalOutputTokens ?? 0)
  if (total <= 0) return null
  const hit = cacheHitPercent(
    cacheRead,
    usage.totalInputTokens ?? 0,
    cacheWrite
  )
  return (
    <div className="border-t border-background/15 pt-1.5">
      <p className="text-[10px] font-medium text-muted-foreground">
        {t("conversation.sessionUsageLabel")}
      </p>
      <p>
        {t("conversation.sessionTotalTooltip", {
          total: formatTokenCount(total),
        })}
      </p>
      {hit > 0 && (
        <p className="text-success">
          {t("conversation.cacheHitTooltip", {
            cached: formatTokenCount(cacheRead),
            pct: hit,
          })}
        </p>
      )}
    </div>
  )
}

export function TokenUsageTooltipBody({
  usage,
  percent,
}: {
  usage: SessionTokenUsage
  percent: number
}) {
  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      <TurnLines usage={usage} percent={percent} />
      <SessionLines usage={usage} />
    </div>
  )
}
