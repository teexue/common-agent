import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Activity } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fetchHealth } from "@/lib/api"
import type { HealthStatus } from "@/types/agent"

export function HealthIndicator() {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    let mounted = true

    const load = () => {
      fetchHealth()
        .then((data) => {
          if (mounted) setHealth(data)
        })
        .catch(() => {
          if (mounted) setHealth({ status: "down" })
        })
    }

    load()
    const interval = setInterval(load, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const isHealthy = health?.status === "up"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-muted">
            <Activity
              className={`h-3.5 w-3.5 ${isHealthy ? "text-success" : "text-destructive"}`}
            />
          </div>
        }
      >
      </TooltipTrigger>
      <TooltipContent>
        {isHealthy ? (
          <span>{t("monitoring.healthy")}</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-destructive">{t("monitoring.unhealthy")}</span>
            {health?.details?.map((d) => (
              <span key={d.name} className="text-[10px]">
                {d.name}: {d.status}
                {d.error && ` - ${d.error}`}
              </span>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
