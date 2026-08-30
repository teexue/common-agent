import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { KanbanSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
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
  const showBoard = board.loading || board.items.length > 0
  return (
    <PageShell>
      <PageHeader
        icon={KanbanSquare}
        title={t("kanban.title")}
        description={t("kanban.subtitle")}
        actions={<NewTaskButton onClick={() => navigate("/kanban/new")} />}
      />
      {showBoard ? (
        <KanbanBoardLanes board={board} navigate={navigate} />
      ) : (
        <KanbanBoardEmpty onCreate={() => navigate("/kanban/new")} />
      )}
    </PageShell>
  )
}

function NewTaskButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" /> {t("kanban.newTask")}
    </Button>
  )
}

function KanbanBoardEmpty({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <PageMain contentClassName="flex h-full items-center justify-center">
      <EmptyState
        icon={KanbanSquare}
        title={t("kanban.empty")}
        description={t("kanban.emptyHint")}
        action={<NewTaskButton onClick={onCreate} />}
      />
    </PageMain>
  )
}

function progressPath(item: KanbanItem): string {
  return item.session_id
    ? `/sessions/${encodeURIComponent(item.session_id)}?live=1`
    : `/kanban/${encodeURIComponent(item.id)}`
}

function KanbanBoardLanes({
  board,
  navigate,
}: {
  board: ReturnType<typeof useKanbanBoard>
  navigate: ReturnType<typeof useNavigate>
}) {
  const { t } = useTranslation()
  return (
    <PageMain
      className="overflow-hidden"
      contentClassName="flex h-full min-h-0 gap-3 overflow-x-auto p-4"
    >
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          label={t(col.labelKey)}
          items={board.items.filter((i) => i.status === col.status)}
          loading={board.loading}
          now={board.now}
          onOpen={(it) => navigate(`/kanban/${encodeURIComponent(it.id)}`)}
          onApprove={board.handleApprove}
          onReject={(id) => navigate(`/kanban/${encodeURIComponent(id)}`)}
          onRequeue={board.handleRequeue}
          onViewProgress={(it) => navigate(progressPath(it))}
        />
      ))}
    </PageMain>
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
