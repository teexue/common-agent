import { useTranslation } from "react-i18next"
import { formatTokenCount } from "@/lib/format"
import {
  cacheHitPercent,
  splitUsageParts,
  type UsageParts,
} from "@/lib/token-usage"
import type { UsageTotals } from "@/types/agent"

function UsageCompositionBar({ parts }: { parts: UsageParts }) {
  const total = Math.max(parts.processed, 1)
  const segs = [
    { key: "cache", n: parts.cacheRead, cls: "bg-chart-3" },
    { key: "fresh", n: parts.freshInput, cls: "bg-primary/80" },
    { key: "write", n: parts.cacheCreation, cls: "bg-chart-4/80" },
    { key: "out", n: parts.output, cls: "bg-chart-2/80" },
  ].filter((s) => s.n > 0)
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
      {segs.map((s) => (
        <div
          key={s.key}
          className={s.cls}
          style={{ width: `${(s.n / total) * 100}%` }}
        />
      ))}
    </div>
  )
}

function UsageStat({
  label,
  value,
  swatch,
}: {
  label: string
  value: string
  swatch: string
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className={`size-1.5 shrink-0 rounded-full ${swatch}`} />
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-medium text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}

function UsageStatRow({ parts }: { parts: UsageParts }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      <UsageStat
        label={t("usage.cacheHit")}
        value={formatTokenCount(parts.cacheRead)}
        swatch="bg-chart-3"
      />
      <UsageStat
        label={t("usage.freshInput")}
        value={formatTokenCount(parts.freshInput)}
        swatch="bg-primary"
      />
      <UsageStat
        label={t("usage.outputTokens")}
        value={formatTokenCount(parts.output)}
        swatch="bg-chart-2"
      />
      <UsageStat
        label={t("usage.cacheWrite")}
        value={formatTokenCount(parts.cacheCreation)}
        swatch="bg-chart-4"
      />
    </div>
  )
}

/** Headline processed volume, cache hit rate, composition bar, and labeled stats. */
export function UsageOverview({ total }: { total: UsageTotals }) {
  const { t } = useTranslation()
  const parts = splitUsageParts(total)
  const hit = cacheHitPercent(
    total.cache_read_tokens,
    total.input_tokens,
    total.cache_creation_tokens
  )
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-heading text-3xl tracking-tight text-foreground tabular-nums">
            {formatTokenCount(parts.processed)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("usage.processedHint", { requests: total.requests })}
          </p>
        </div>
        {hit > 0 && (
          <p className="text-sm font-medium text-success">
            {t("usage.cacheHitRate", { pct: hit })}
          </p>
        )}
      </div>
      <UsageCompositionBar parts={parts} />
      <UsageStatRow parts={parts} />
    </div>
  )
}
