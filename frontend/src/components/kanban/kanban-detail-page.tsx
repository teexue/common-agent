import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KanbanSquare, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { fetchKanbanItem } from "@/lib/api"
import type { KanbanItem } from "@/types/agent"
import { KanbanDetailBody } from "./kanban-detail-body"
import { KanbanDetailHeader } from "./kanban-detail-header"

interface KanbanDetailPageProps {
  taskId: string
  onBack: () => void
  onViewLogs: (sessionId: string) => void
}

export function KanbanDetailPage({
  taskId,
  onBack,
  onViewLogs,
}: KanbanDetailPageProps) {
  const { t } = useTranslation()
  const detail = useKanbanDetail(taskId)

  if (detail.error && !detail.item) {
    return (
      <PageShell>
        <PageHeader icon={KanbanSquare} title={t("kanban.title")} />
        <PageMain contentClassName="max-w-3xl">
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {detail.error}
          </p>
        </PageMain>
      </PageShell>
    )
  }

  if (!detail.item) {
    return (
      <PageShell>
        <PageHeader icon={KanbanSquare} title={t("kanban.title")} />
        <PageMain contentClassName="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </PageMain>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <KanbanDetailHeader
        item={detail.item}
        busy={detail.busy}
        onViewLogs={onViewLogs}
        onDeleted={onBack}
      />
      <PageMain contentClassName="max-w-3xl">
        <KanbanDetailBody
          item={detail.item}
          error={detail.error}
          feedback={detail.feedback}
          setFeedback={detail.setFeedback}
          busy={detail.busy}
          runAction={detail.runAction}
        />
      </PageMain>
    </PageShell>
  )
}

function useKanbanDetail(taskId: string) {
  const [item, setItem] = useState<KanbanItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    return fetchKanbanItem(taskId)
      .then((next) => {
        setItem(next)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [taskId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      try {
        await fn()
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  return { item, error, feedback, setFeedback, busy, runAction }
}
