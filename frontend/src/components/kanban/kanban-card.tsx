import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Check, Loader2, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KanbanItem } from "@/types/agent"
import { kanbanPriorityRail } from "./kanban-lane"

interface KanbanCardProps {
  item: KanbanItem
  now: number
  onOpen: (item: KanbanItem) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRequeue: (id: string) => void
  onViewProgress: (item: KanbanItem) => void
}

export function KanbanCard({ item, now, ...actions }: KanbanCardProps) {
  const dueDate = item.due_at ? new Date(item.due_at) : null
  const overdue =
    dueDate !== null &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < now &&
    item.status !== "done"
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => actions.onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          actions.onOpen(item)
        }
      }}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border-l-2 bg-card px-3 py-2.5 text-left shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md hover:ring-primary/20",
        kanbanPriorityRail(item.priority)
      )}
    >
      <p className="text-[13px] leading-snug font-medium text-foreground">
        {item.title}
      </p>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {item.agent}
      </p>
      <KanbanCardMeta item={item} dueDate={dueDate} overdue={overdue} />
      <KanbanCardActions item={item} actions={actions} />
    </div>
  )
}

function KanbanCardMeta({
  item,
  dueDate,
  overdue,
}: {
  item: KanbanItem
  dueDate: Date | null
  overdue: boolean
}) {
  const { t } = useTranslation()
  const tags = item.tags ?? []
  if (!dueDate && item.attempts <= 0 && tags.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
      {tags.map((tag) => (
        <span key={tag} className="text-muted-foreground/80">
          {tag}
        </span>
      ))}
      {dueDate && (
        <span className={cn(overdue && "font-medium text-destructive")}>
          {t("kanban.dueAt")} {dueDate.toLocaleDateString()}
        </span>
      )}
      {item.attempts > 0 && (
        <span>{t("kanban.attempts", { count: item.attempts })}</span>
      )}
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

function CardAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
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
    <div className="mt-0.5 flex items-center gap-1">
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
      <CardAction onClick={() => actions.onViewProgress(item)}>
        {t("kanban.viewProgress")}
      </CardAction>
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
    <div className="mt-0.5 flex flex-col gap-1">
      {item.result && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {item.result}
        </p>
      )}
      <div className="flex gap-0.5">
        <CardAction onClick={() => actions.onApprove(item.id)}>
          <Check className="h-3 w-3" /> {t("common.approve")}
        </CardAction>
        <CardAction onClick={() => actions.onReject(item.id)}>
          <X className="h-3 w-3" /> {t("common.reject")}
        </CardAction>
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
    <div className="mt-0.5">
      <CardAction onClick={() => actions.onRequeue(item.id)}>
        <RotateCcw className="h-3 w-3" /> {t("kanban.requeue")}
      </CardAction>
    </div>
  )
}
