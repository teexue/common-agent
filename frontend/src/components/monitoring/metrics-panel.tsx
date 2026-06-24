import { useEffect, useState } from "react"
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Users,
} from "lucide-react"
import { fetchMetrics } from "@/lib/api"
import type { MetricsData } from "@/types/agent"

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

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = () => {
      fetchMetrics()
        .then((data) => {
          if (mounted) {
            setMetrics(data)
            setError(null)
          }
        })
        .catch((err) => {
          if (mounted) setError(err.message)
        })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (!metrics) return null

  const cards = [
    {
      icon: Activity,
      label: "Goroutines",
      value: String(metrics.goroutines),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: HardDrive,
      label: "堆内存 (已分配)",
      value: formatBytes(metrics.heap_alloc_bytes),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Database,
      label: "堆内存 (系统)",
      value: formatBytes(metrics.heap_sys_bytes),
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      icon: Users,
      label: "活跃会话",
      value: String(metrics.active_sessions),
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      icon: Cpu,
      label: "运行时间",
      value: formatUptime(metrics.uptime_seconds),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ]

  const agentEntries = metrics.agents ? Object.entries(metrics.agents) : []

  return (
    <div className="space-y-4">
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

      {agentEntries.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Agent 统计
          </p>
          <div className="space-y-1.5">
            {agentEntries.map(([name, stats]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-xs font-medium text-foreground truncate">
                  {name}
                </span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                  <span>{stats.runs} 次</span>
                  <span>{stats.avg_ms > 0 ? `${(stats.avg_ms / 1000).toFixed(1)}s` : "-"}</span>
                  <span
                    className={
                      stats.last_status === "completed"
                        ? "text-success"
                        : stats.last_status === "failed"
                          ? "text-destructive"
                          : ""
                    }
                  >
                    {stats.last_status === "completed" ? "✓" : stats.last_status === "failed" ? "✗" : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
