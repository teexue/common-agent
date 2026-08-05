import { useTranslation } from "react-i18next"
import { Check, RotateCcw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KanbanItem } from "@/types/agent"

interface KanbanCardProps {
  item: KanbanItem
  now: number
  onOpen: (item: KanbanItem) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRequeue: (id: string) => void
}

function priorityClass(priority: number): string {
  switch (priority) {
    case 3:
      return "bg-destructive/10 text-destructive"
    case 2:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function KanbanCard({ item, now, onOpen, onApprove, onReject, onRequeue }: KanbanCardProps) {
  const { t } = useTranslation()
  const priorityLabel =
    item.priority === 3
      ? t("kanban.priorityHigh")
      : item.priority === 2
        ? t("kanban.priorityMedium")
        : t("kanban.priorityLow")

  const dueDate = item.due_at ? new Date(item.due_at) : null
  const overdue = dueDate !== null && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now && item.status !== "done"

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/20 hover:bg-muted/30"
    >
      <p className="text-xs font-medium leading-snug text-foreground">{item.title}</p>
      <p className="truncate font-mono text-[10px] text-muted-foreground">{item.agent}</p>

      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline" className={cn("rounded-md border-transparent px-1.5 py-0.5 text-[10px]", priorityClass(item.priority))}>
          {priorityLabel}
        </Badge>
        {(item.tags ?? []).map((tag) => (
          <Badge key={tag} variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        {dueDate && (
          <span className={cn(overdue && "font-medium text-destructive")}>
            {t("kanban.dueAt")} {dueDate.toLocaleDateString()}
          </span>
        )}
        {item.attempts > 0 && <span>{t("kanban.attempts", { count: item.attempts })}</span>}
      </div>

      {item.status === "review" && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
          {item.result && (
            <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{item.result}</p>
          )}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-6 flex-1 gap-1 rounded-lg text-[10px]"
              onClick={(e) => { e.stopPropagation(); onApprove(item.id) }}
            >
              <Check className="h-3 w-3" /> {t("common.approve")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 flex-1 gap-1 rounded-lg text-[10px]"
              onClick={(e) => { e.stopPropagation(); onReject(item.id) }}
            >
              <X className="h-3 w-3" /> {t("common.reject")}
            </Button>
          </div>
        </div>
      )}

      {item.status === "failed" && (
        <div className="border-t border-border/60 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-full gap-1 rounded-lg text-[10px]"
            onClick={(e) => { e.stopPropagation(); onRequeue(item.id) }}
          >
            <RotateCcw className="h-3 w-3" /> {t("kanban.requeue")}
          </Button>
        </div>
      )}
    </button>
  )
}
