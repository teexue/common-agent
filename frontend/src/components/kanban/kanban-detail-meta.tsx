import { useTranslation } from "react-i18next"
import type { KanbanItem } from "@/types/agent"

function formatTime(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function MetaBit({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <span className="font-mono text-foreground/80">{value}</span>
    </span>
  )
}

export function KanbanDetailMeta({ item }: { item: KanbanItem }) {
  const { t } = useTranslation()
  return (
    <footer className="mt-8 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
      {item.workdir && (
        <MetaBit label={t("kanban.fieldWorkdir")} value={item.workdir} />
      )}
      {item.due_at && (
        <MetaBit label={t("kanban.dueAt")} value={formatTime(item.due_at)} />
      )}
      <MetaBit
        label={t("kanban.createdAt")}
        value={formatTime(item.created_at)}
      />
      {item.finished_at && (
        <MetaBit
          label={t("kanban.finishedAt")}
          value={formatTime(item.finished_at)}
        />
      )}
      {item.attempts > 0 && (
        <span>{t("kanban.attempts", { count: item.attempts })}</span>
      )}
    </footer>
  )
}
