import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/shared/empty-state"
import { useTranslation } from "react-i18next"
import type { KanbanItem } from "@/types/agent"
import { KanbanCard } from "./kanban-card"

export function KanbanColumn({
  label,
  items,
  loading,
  now,
  onOpen,
  onApprove,
  onReject,
  onRequeue,
  onViewProgress,
}: {
  label: string
  items: KanbanItem[]
  loading: boolean
  now: number
  onOpen: (item: KanbanItem) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRequeue: (id: string) => void
  onViewProgress: (item: KanbanItem) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <Badge
          variant="secondary"
          className="rounded-md px-1.5 py-0 text-[10px]"
        >
          {items.length}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 pr-1">
          {items.length === 0 ? (
            <EmptyState
              title={loading ? t("common.loading") : t("kanban.empty")}
            />
          ) : (
            items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                now={now}
                onOpen={onOpen}
                onApprove={onApprove}
                onReject={onReject}
                onRequeue={onRequeue}
                onViewProgress={onViewProgress}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
