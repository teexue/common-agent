import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { KanbanSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { KanbanColumn } from "./kanban-column"
import {
  approveKanbanItem,
  fetchKanbanItems,
  requeueKanbanItem,
} from "@/lib/api"
import type { KanbanItem, KanbanStatus } from "@/types/agent"

const COLUMNS: { status: KanbanStatus; labelKey: string }[] = [
  { status: "pending", labelKey: "kanban.colPending" },
  { status: "running", labelKey: "kanban.colRunning" },
  { status: "review", labelKey: "kanban.colReview" },
  { status: "done", labelKey: "kanban.colDone" },
  { status: "failed", labelKey: "kanban.colFailed" },
]

export function KanbanPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const board = useKanbanBoard()

  return (
    <PageShell>
      <PageHeader
        icon={KanbanSquare}
        title={t("kanban.title")}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => navigate("/kanban/new")}
          >
            <Plus className="h-3.5 w-3.5" /> {t("kanban.newTask")}
          </Button>
        }
      />
      <PageMain contentClassName="flex h-full min-w-max gap-3">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            label={t(col.labelKey)}
            items={board.items.filter((i) => i.status === col.status)}
            loading={board.loading}
            now={board.now}
            onOpen={(it) => navigate(`/kanban/${encodeURIComponent(it.id)}`)}
            onApprove={board.handleApprove}
            onReject={(id) => navigate(`/kanban/${encodeURIComponent(id)}`)}
            onRequeue={board.handleRequeue}
            onViewProgress={(it) =>
              it.session_id
                ? navigate(
                    `/sessions/${encodeURIComponent(it.session_id)}?live=1`
                  )
                : navigate(`/kanban/${encodeURIComponent(it.id)}`)
            }
          />
        ))}
      </PageMain>
    </PageShell>
  )
}

function useKanbanBoard() {
  const [items, setItems] = useState<KanbanItem[]>([])
  const [now, setNow] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchKanbanItems()
      setItems(data ?? [])
      setNow(Date.now())
    } catch (err) {
      console.error("Failed to fetch kanban items:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void refresh()
    }, 0)
    const timer = window.setInterval(() => {
      void refresh()
    }, 5_000)
    return () => {
      window.clearTimeout(kickoff)
      window.clearInterval(timer)
    }
  }, [refresh])

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        await refresh()
      } catch (err) {
        console.error("Kanban action failed:", err)
      }
    },
    [refresh]
  )

  return {
    items,
    now,
    loading,
    handleApprove: (id: string) => void runAction(() => approveKanbanItem(id)),
    handleRequeue: (id: string) => void runAction(() => requeueKanbanItem(id)),
  }
}
