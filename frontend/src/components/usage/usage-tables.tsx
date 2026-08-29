import { useTranslation } from "react-i18next"
import { formatTokenCount } from "@/lib/format"
import type { UsageDay, UsageTotals } from "@/types/agent"

/** Horizontal bars of daily token usage (oldest → newest, top → bottom). */
export function UsageBarChart({ days }: { days: UsageDay[] }) {
  const { t } = useTranslation()
  if (days.length === 0) return null
  const max = Math.max(...days.map((d) => d.input_tokens + d.output_tokens), 1)
  return (
    <div className="space-y-1.5">
      {days.map((day) => {
        const total = day.input_tokens + day.output_tokens
        const inPct = total > 0 ? (day.input_tokens / max) * 100 : 0
        const outPct = total > 0 ? (day.output_tokens / max) * 100 : 0
        return (
          <div key={day.date} className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">
              {day.date.slice(5)}
            </span>
            <div className="flex h-3.5 min-w-0 flex-1 items-center gap-px">
              <div
                className="h-full rounded-l-sm bg-primary/70"
                style={{ width: `${inPct}%` }}
                title={t("usage.inputTokens")}
              />
              <div
                className="h-full rounded-r-sm bg-chart-2/70"
                style={{ width: `${outPct}%` }}
                title={t("usage.outputTokens")}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
              {formatTokenCount(total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export interface UsageRow {
  key: string
  label: string
  sub?: string
  totals: UsageTotals
}

/** Compact table of per-model / per-session aggregates. */
export function UsageTable({ rows }: { rows: UsageRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
        >
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
          <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] text-muted-foreground tabular-nums">
            <span title="input">
              {formatTokenCount(row.totals.input_tokens)}
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span title="output">
              {formatTokenCount(row.totals.output_tokens)}
            </span>
            <span className="w-10 text-right font-medium text-foreground">
              {formatTokenCount(
                row.totals.input_tokens + row.totals.output_tokens
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
