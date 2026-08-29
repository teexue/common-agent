import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Bot, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { fetchAgentDetail } from "@/lib/api"
import type { AgentDetail } from "@/types/agent"
import { AgentDetailBody } from "./agent-detail-body"
import { AgentHeader } from "./agent-detail-header"

interface AgentDetailPageProps {
  agentId: string
  onEdit?: (id: string) => void
  onCopy?: (id: string) => void
  onDelete?: (id: string) => void
}

export function AgentDetailPage({
  agentId,
  onEdit,
  onCopy,
  onDelete,
}: AgentDetailPageProps) {
  const { t } = useTranslation()
  const { detail, loading, error } = useAgentDetail(agentId)
  return (
    <PageShell>
      <PageHeader icon={Bot} title={t("agent.detailTitle")} />
      <PageMain contentClassName="max-w-3xl">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}
        {detail && (
          <ScrollArea className="max-h-full">
            <div className="flex flex-col gap-4">
              <AgentHeader
                detail={detail}
                onEdit={onEdit}
                onCopy={onCopy}
                onDelete={onDelete}
              />
              <Separator />
              <AgentDetailBody detail={detail} />
            </div>
          </ScrollArea>
        )}
      </PageMain>
    </PageShell>
  )
}

function useAgentDetail(agentId: string) {
  const [detail, setDetail] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId) return
    let cancelled = false
    const kickoff = window.setTimeout(() => {
      setLoading(true)
      setError(null)
    }, 0)
    fetchAgentDetail(agentId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      window.clearTimeout(kickoff)
    }
  }, [agentId])

  return { detail, loading, error }
}
