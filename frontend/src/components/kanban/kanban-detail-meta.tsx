import { useTranslation } from "react-i18next"
import type { KanbanItem } from "@/types/agent"

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px] text-foreground">
        {value}
      </span>
    </div>
  )
}

function formatTime(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export function KanbanDetailMeta({ item }: { item: KanbanItem }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1 rounded-xl border border-border/60 px-3 py-2">
      <MetaRow label={t("kanban.fieldAgent")} value={item.agent} />
      {item.workdir && (
        <MetaRow label={t("kanban.fieldWorkdir")} value={item.workdir} />
      )}
      {item.due_at && (
        <MetaRow label={t("kanban.dueAt")} value={formatTime(item.due_at)} />
      )}
      <MetaRow
        label={t("kanban.createdAt")}
        value={formatTime(item.created_at)}
      />
      <MetaRow
        label={t("kanban.updatedAt")}
        value={formatTime(item.updated_at)}
      />
      {item.finished_at && (
        <MetaRow
          label={t("kanban.finishedAt")}
          value={formatTime(item.finished_at)}
        />
      )}
      {item.attempts > 0 && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="shrink-0 text-muted-foreground">
            {t("kanban.attempts", { count: item.attempts })}
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {item.attempts}
          </span>
        </div>
      )}
    </div>
  )
}
