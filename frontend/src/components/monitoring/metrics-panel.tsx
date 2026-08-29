import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Users,
  type LucideIcon,
} from "lucide-react"
import { fetchMetrics } from "@/lib/api"
import type { MetricsData } from "@/types/agent"
import type { TFunction } from "i18next"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

interface MetricCard {
  icon: LucideIcon
  label: string
  value: string
  color: string
  bg: string
}

function buildMetricCards(m: MetricsData, t: TFunction): MetricCard[] {
  return [
    {
      icon: Activity,
      label: "Goroutines",
      value: String(m.goroutines),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: HardDrive,
      label: t("monitoring.heapAlloc"),
      value: formatBytes(m.heap_alloc_bytes),
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      icon: Database,
      label: t("monitoring.heapSys"),
      value: formatBytes(m.heap_sys_bytes),
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      icon: Users,
      label: t("monitoring.activeSessions"),
      value: String(m.active_sessions),
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      icon: Cpu,
      label: t("monitoring.uptime"),
      value: formatUptime(m.uptime_seconds),
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ]
}

function statusMark(status: string) {
  if (status === "completed") return { cls: "text-success", mark: "✓" }
  if (status === "failed") return { cls: "text-destructive", mark: "✗" }
  return { cls: "", mark: "-" }
}

function AgentStats({
  agents,
}: {
  agents: Record<string, { runs: number; avg_ms: number; last_status: string }>
}) {
  const { t } = useTranslation()
  const entries = Object.entries(agents)
  if (entries.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {t("monitoring.agentStats")}
      </p>
      <div className="space-y-1.5">
        {entries.map(([name, stats]) => {
          const { cls, mark } = statusMark(stats.last_status)
          return (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <span className="truncate text-xs font-medium text-foreground">
                {name}
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span>{t("monitoring.runs", { count: stats.runs })}</span>
                <span>
                  {stats.avg_ms > 0
                    ? `${(stats.avg_ms / 1000).toFixed(1)}s`
                    : "-"}
                </span>
                <span className={cls}>{mark}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricCardGrid({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 p-2.5"
        >
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${card.bg}`}
          >
            <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">{card.label}</p>
            <p className="font-mono text-xs font-medium text-foreground">
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function applyMetrics(
  mounted: boolean,
  data: MetricsData | null,
  message: string | null,
  setMetrics: (data: MetricsData | null) => void,
  setError: (message: string | null) => void
) {
  if (!mounted) return
  if (data) {
    setMetrics(data)
    setError(null)
    return
  }
  setError(message)
}

function useMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = () => {
      fetchMetrics()
        .then((data) => applyMetrics(mounted, data, null, setMetrics, setError))
        .catch((err: Error) =>
          applyMetrics(mounted, null, err.message, setMetrics, setError)
        )
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }
    load()
    const interval = setInterval(load, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { metrics, loading, error }
}

export function MetricsPanel() {
  const { t } = useTranslation()
  const { metrics, loading, error } = useMetrics()
  if (loading)
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  if (error)
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
        {error}
      </div>
    )
  if (!metrics) return null
  return (
    <div className="space-y-4">
      <MetricCardGrid cards={buildMetricCards(metrics, t)} />
      {metrics.agents && <AgentStats agents={metrics.agents} />}
    </div>
  )
}
