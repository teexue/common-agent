import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KanbanSquare, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KanbanCard } from "./kanban-card"
import { KanbanCreateDialog } from "./kanban-create-dialog"
import { KanbanDetailDialog } from "./kanban-detail-dialog"
import {
  approveKanbanItem,
  deleteKanbanItem,
  fetchKanbanItems,
  rejectKanbanItem,
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

/** Five-column kanban board with polling refresh. */
export function KanbanPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<KanbanItem[]>([])
  const [now, setNow] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    const kickoff = window.setTimeout(() => { void refresh() }, 0)
    const timer = window.setInterval(() => { void refresh() }, 5_000)
    return () => {
      window.clearTimeout(kickoff)
      window.clearInterval(timer)
    }
  }, [refresh])

  const runAction = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await refresh()
    } catch (err) {
      console.error("Kanban action failed:", err)
    }
  }, [refresh])

  const handleApprove = useCallback((id: string) => void runAction(() => approveKanbanItem(id)), [runAction])
  const handleRequeue = useCallback((id: string) => void runAction(() => requeueKanbanItem(id)), [runAction])
  const handleReject = useCallback((id: string, feedback: string) => void runAction(() => rejectKanbanItem(id, feedback)), [runAction])
  const handleDelete = useCallback((id: string) => {
    const target = items.find((i) => i.id === id)
    if (!window.confirm(t("kanban.deleteConfirm", { title: target?.title ?? id }))) return
    setSelectedId(null)
    void runAction(() => deleteKanbanItem(id))
  }, [items, runAction, t])

  const selectedItem = selectedId ? items.find((i) => i.id === selectedId) ?? null : null

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-4 w-4 text-primary" />
          <h1 className="font-heading text-base tracking-tight text-foreground">{t("kanban.title")}</h1>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> {t("kanban.newTask")}
        </Button>
      </header>

      <main className="flex-1 overflow-x-auto">
        <div className="flex h-full min-w-max gap-3 px-6 py-6">
          {COLUMNS.map((col) => {
            const columnItems = items.filter((i) => i.status === col.status)
            return (
              <section key={col.status} className="flex w-64 shrink-0 flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-medium text-foreground">{t(col.labelKey)}</span>
                  <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{columnItems.length}</Badge>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="flex flex-col gap-2 pr-1">
                    {columnItems.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-8">
                        <p className="text-[10px] text-muted-foreground">
                          {loading ? t("common.loading") : t("kanban.empty")}
                        </p>
                      </div>
                    ) : (
                      columnItems.map((item) => (
                        <KanbanCard
                          key={item.id}
                          item={item}
                          now={now}
                          onOpen={(it) => setSelectedId(it.id)}
                          onApprove={handleApprove}
                          onReject={(id) => setSelectedId(id)}
                          onRequeue={handleRequeue}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </section>
            )
          })}
        </div>
      </main>

      <KanbanCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refresh()} />
      <KanbanDetailDialog
        item={selectedItem}
        open={selectedItem !== null}
        onOpenChange={(o) => { if (!o) setSelectedId(null) }}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequeue={handleRequeue}
        onDelete={handleDelete}
      />
    </div>
  )
}
