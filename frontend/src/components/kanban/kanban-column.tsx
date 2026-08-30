import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import type { KanbanItem, KanbanStatus } from "@/types/agent"
import { cn } from "@/lib/utils"
import { KanbanCard } from "./kanban-card"
import { KANBAN_LANE_TICK } from "./kanban-lane"

export function KanbanColumn({
  status,
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
  status: KanbanStatus
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
  return (
    <section className="flex min-h-0 min-w-[16.5rem] flex-1 flex-col rounded-2xl bg-muted/35 ring-1 ring-border/50">
      <ColumnHeader status={status} label={label} count={items.length} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {items.length === 0 ? (
          <ColumnEmpty loading={loading} />
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
    </section>
  )
}

function ColumnHeader({
  status,
  label,
  count,
}: {
  status: KanbanStatus
  label: string
  count: number
}) {
  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-2">
      <span
        className={cn(
          "h-4 w-0.5 shrink-0 rounded-full",
          KANBAN_LANE_TICK[status]
        )}
      />
      <h2 className="font-heading text-[15px] leading-none tracking-tight text-foreground">
        {label}
      </h2>
      <Badge
        variant="secondary"
        className="ml-auto rounded-md px-1.5 py-0 font-mono text-[10px] text-muted-foreground tabular-nums"
      >
        {count}
      </Badge>
    </header>
  )
}

function ColumnEmpty({ loading }: { loading: boolean }) {
  const { t } = useTranslation()
  return (
    <p className="px-1 py-8 text-center text-[11px] text-muted-foreground/45">
      {loading ? t("common.loading") : t("kanban.empty")}
    </p>
  )
}
