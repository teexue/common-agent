import { useTranslation } from "react-i18next"
import { Check, Loader2, RotateCcw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/shared/list-row"
import { cn } from "@/lib/utils"
import type { KanbanItem } from "@/types/agent"

interface KanbanCardProps {
  item: KanbanItem
  now: number
  onOpen: (item: KanbanItem) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRequeue: (id: string) => void
  onViewProgress: (item: KanbanItem) => void
}

function priorityClass(priority: number): string {
  switch (priority) {
    case 3:
      return "bg-destructive/10 text-destructive"
    case 2:
      return "bg-warning/10 text-warning"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function KanbanCard({ item, now, ...actions }: KanbanCardProps) {
  const dueDate = item.due_at ? new Date(item.due_at) : null
  const overdue =
    dueDate !== null &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < now &&
    item.status !== "done"

  return (
    <ListRow
      onClick={() => actions.onOpen(item)}
      className="flex w-full flex-col gap-2 px-3 py-2.5 text-left"
    >
      <p className="text-xs leading-snug font-medium text-foreground">
        {item.title}
      </p>
      <p className="truncate font-mono text-[10px] text-muted-foreground">
        {item.agent}
      </p>
      <KanbanCardTags item={item} />
      <KanbanCardDue
        dueDate={dueDate}
        overdue={overdue}
        attempts={item.attempts}
      />
      <KanbanCardActions item={item} actions={actions} />
    </ListRow>
  )
}

function KanbanCardTags({ item }: { item: KanbanItem }) {
  const { t } = useTranslation()
  const priorityLabel =
    item.priority === 3
      ? t("kanban.priorityHigh")
      : item.priority === 2
        ? t("kanban.priorityMedium")
        : t("kanban.priorityLow")
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "rounded-md border-transparent px-1.5 py-0.5 text-[10px]",
          priorityClass(item.priority)
        )}
      >
        {priorityLabel}
      </Badge>
      {(item.tags ?? []).map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="rounded-md px-1.5 py-0.5 text-[10px]"
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}

function KanbanCardDue({
  dueDate,
  overdue,
  attempts,
}: {
  dueDate: Date | null
  overdue: boolean
  attempts: number
}) {
  const { t } = useTranslation()
  if (!dueDate && attempts <= 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      {dueDate && (
        <span className={cn(overdue && "font-medium text-destructive")}>
          {t("kanban.dueAt")} {dueDate.toLocaleDateString()}
        </span>
      )}
      {attempts > 0 && <span>{t("kanban.attempts", { count: attempts })}</span>}
    </div>
  )
}

function KanbanCardActions({
  item,
  actions,
}: {
  item: KanbanItem
  actions: Omit<KanbanCardProps, "item" | "now">
}) {
  if (item.status === "running")
    return <RunningActions item={item} actions={actions} />
  if (item.status === "review")
    return <ReviewActions item={item} actions={actions} />
  if (item.status === "failed")
    return <FailedActions item={item} actions={actions} />
  return null
}

function RunningActions({
  item,
  actions,
}: {
  item: KanbanItem
  actions: Omit<KanbanCardProps, "item" | "now">
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
      <Button
        variant="outline"
        size="sm"
        className="h-6 flex-1 gap-1 rounded-lg text-[10px]"
        onClick={(e) => {
          e.stopPropagation()
          actions.onViewProgress(item)
        }}
      >
        {t("kanban.viewProgress")}
      </Button>
    </div>
  )
}

function ReviewActions({
  item,
  actions,
}: {
  item: KanbanItem
  actions: Omit<KanbanCardProps, "item" | "now">
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
      {item.result && (
        <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
          {item.result}
        </p>
      )}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-6 flex-1 gap-1 rounded-lg text-[10px]"
          onClick={(e) => {
            e.stopPropagation()
            actions.onApprove(item.id)
          }}
        >
          <Check className="h-3 w-3" /> {t("common.approve")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 flex-1 gap-1 rounded-lg text-[10px]"
          onClick={(e) => {
            e.stopPropagation()
            actions.onReject(item.id)
          }}
        >
          <X className="h-3 w-3" /> {t("common.reject")}
        </Button>
      </div>
    </div>
  )
}

function FailedActions({
  item,
  actions,
}: {
  item: KanbanItem
  actions: Omit<KanbanCardProps, "item" | "now">
}) {
  const { t } = useTranslation()
  return (
    <div className="border-t border-border/60 pt-2">
      <Button
        variant="outline"
        size="sm"
        className="h-6 w-full gap-1 rounded-lg text-[10px]"
        onClick={(e) => {
          e.stopPropagation()
          actions.onRequeue(item.id)
        }}
      >
        <RotateCcw className="h-3 w-3" /> {t("kanban.requeue")}
      </Button>
    </div>
  )
}
