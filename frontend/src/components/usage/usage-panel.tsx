import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Coins, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { fetchUsageSummary } from "@/lib/api"
import { formatTokenCount } from "@/lib/format"
import { useAuth } from "@/lib/auth"
import { UsageBarChart, UsageTable } from "./usage-tables"
import type { UsageSummary, UsageTotals } from "@/types/agent"

const DAY_VALUES = [0, 1, 7, 30] as const

function selectNumber(v: unknown): number | undefined {
  if (v && typeof v === "object" && "value" in v)
    return (v as { value: number }).value
  return undefined
}

function useUsageData(isAdmin: boolean) {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number>(0)

  const load = useCallback(async () => {
    try {
      const data = await fetchUsageSummary({ days, all: isAdmin })
      setSummary(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [days, isAdmin])

  useEffect(() => {
    let cancelled = false
    fetchUsageSummary({ days, all: isAdmin })
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days, isAdmin])

  return { summary, error, loading, days, setDays, load }
}

function UsageToolbar({
  days,
  onDays,
  onRefresh,
}: {
  days: number
  onDays: (value: number) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const dayOptions = DAY_VALUES.map((v) => ({
    value: v,
    label: t(`usage.days${v}`),
  }))
  return (
    <div className="flex items-center gap-2">
      <Select
        value={{ value: days, label: t(`usage.days${days}`) }}
        onValueChange={(v) => {
          const next = selectNumber(v)
          if (next !== undefined) onDays(next)
        }}
      >
        <SelectTrigger className="h-8 w-36 rounded-xl text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {dayOptions.map((o) => (
            <SelectItem key={o.value} value={o}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-8 w-8"
        onClick={onRefresh}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function UsageCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 p-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Coins className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="font-mono text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function UsageTotalsRow({ total }: { total: UsageTotals }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <UsageCard
        label={t("usage.totalTokens")}
        value={formatTokenCount(total.input_tokens + total.output_tokens)}
      />
      <UsageCard
        label={t("usage.inputTokens")}
        value={formatTokenCount(total.input_tokens)}
      />
      <UsageCard
        label={t("usage.outputTokens")}
        value={formatTokenCount(total.output_tokens)}
      />
      <UsageCard label={t("usage.requests")} value={String(total.requests)} />
    </div>
  )
}

function UsageSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

function UsageReport({ summary }: { summary: UsageSummary }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <UsageTotalsRow total={summary.total} />
      <UsageSection title={t("usage.daily")}>
        <UsageBarChart days={summary.days} />
      </UsageSection>
      <UsageSection title={t("usage.byModel")}>
        <UsageTable
          rows={summary.by_model.map((m) => ({
            key: m.model,
            label: m.model,
            totals: m,
          }))}
        />
      </UsageSection>
      <UsageSection title={t("usage.bySession")}>
        <UsageTable
          rows={summary.by_session.map((s) => ({
            key: s.session_id,
            label: s.agent || s.session_id,
            sub: s.agent ? s.session_id : undefined,
            totals: s,
          }))}
        />
      </UsageSection>
    </div>
  )
}

/** Aggregate token consumption panel (embeds inside the Admin hub). */
export function UsagePanel() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const { summary, error, loading, days, setDays, load } = useUsageData(isAdmin)

  return (
    <div className="space-y-4">
      <UsageToolbar
        days={days}
        onDays={setDays}
        onRefresh={() => void load()}
      />
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {loading && !summary && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {summary && summary.total.requests === 0 && (
        <EmptyState title={t("usage.empty")} />
      )}
      {summary && summary.total.requests > 0 && (
        <UsageReport summary={summary} />
      )}
    </div>
  )
}
