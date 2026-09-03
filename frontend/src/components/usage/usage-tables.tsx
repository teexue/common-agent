import { useTranslation } from "react-i18next"
import { formatTokenCount } from "@/lib/format"
import { cacheHitPercent, splitUsageParts } from "@/lib/token-usage"
import type { UsageDay, UsageTotals } from "@/types/agent"

function UsageDayRow({ day, max }: { day: UsageDay; max: number }) {
  const { t } = useTranslation()
  const parts = splitUsageParts(day)
  const hit = cacheHitPercent(
    day.cache_read_tokens,
    day.input_tokens,
    day.cache_creation_tokens
  )
  const segs = [
    { key: "cache", n: parts.cacheRead, cls: "bg-chart-3" },
    { key: "fresh", n: parts.freshInput, cls: "bg-primary/80" },
    { key: "write", n: parts.cacheCreation, cls: "bg-chart-4/80" },
    { key: "out", n: parts.output, cls: "bg-chart-2/80" },
  ]
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">
        {day.date.slice(5)}
      </span>
      <div className="flex h-3.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
        {segs.map((s) =>
          s.n > 0 ? (
            <div
              key={s.key}
              className={s.cls}
              style={{ width: `${(s.n / max) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {formatTokenCount(parts.processed)}
      </span>
      <span className="hidden w-10 shrink-0 text-right font-mono text-[10px] text-success sm:block">
        {hit > 0 ? `${hit}%` : t("usage.noCache")}
      </span>
    </div>
  )
}

function UsageBarLegend() {
  const { t } = useTranslation()
  const items = [
    { cls: "bg-chart-3", key: "usage.cacheHit" },
    { cls: "bg-primary", key: "usage.freshInput" },
    { cls: "bg-chart-4", key: "usage.cacheWrite" },
    { cls: "bg-chart-2", key: "usage.outputTokens" },
  ]
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${item.cls}`} />
          {t(item.key)}
        </span>
      ))}
    </div>
  )
}

/** Horizontal bars of daily token usage (oldest → newest), including cache. */
export function UsageBarChart({ days }: { days: UsageDay[] }) {
  if (days.length === 0) return null
  const max = Math.max(...days.map((d) => splitUsageParts(d).processed), 1)
  return (
    <div className="space-y-1.5">
      <UsageBarLegend />
      {days.map((day) => (
        <UsageDayRow key={day.date} day={day} max={max} />
      ))}
    </div>
  )
}

export interface UsageRow {
  key: string
  label: string
  sub?: string
  totals: UsageTotals
}

function UsageTableHead() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      <span className="min-w-0 flex-1">{t("usage.colName")}</span>
      <span className="w-12 shrink-0 text-right">{t("usage.colInput")}</span>
      <span className="w-12 shrink-0 text-right">{t("usage.colOutput")}</span>
      <span className="w-12 shrink-0 text-right">{t("usage.cacheHit")}</span>
      <span className="w-10 shrink-0 text-right">{t("usage.colHitRate")}</span>
      <span className="w-12 shrink-0 text-right">{t("usage.colTotal")}</span>
    </div>
  )
}

function UsageTableRow({ row }: { row: UsageRow }) {
  const parts = splitUsageParts(row.totals)
  const hit = cacheHitPercent(
    row.totals.cache_read_tokens,
    row.totals.input_tokens,
    row.totals.cache_creation_tokens
  )
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {row.label}
        </p>
        {row.sub && (
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {row.sub}
          </p>
        )}
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {formatTokenCount(parts.prompt)}
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {formatTokenCount(parts.output)}
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
        {formatTokenCount(parts.cacheRead)}
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-[10px] text-success tabular-nums">
        {hit > 0 ? `${hit}%` : "—"}
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] font-medium text-foreground tabular-nums">
        {formatTokenCount(parts.processed)}
      </span>
    </div>
  )
}

/** Compact table of per-model / per-session aggregates with cache columns. */
export function UsageTable({ rows }: { rows: UsageRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1.5">
      <UsageTableHead />
      {rows.map((row) => (
        <UsageTableRow key={row.key} row={row} />
      ))}
    </div>
  )
}
