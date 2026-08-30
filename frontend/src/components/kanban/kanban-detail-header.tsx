import { useTranslation } from "react-i18next"
import { KanbanSquare, ScrollText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { deleteKanbanItem } from "@/lib/api"
import type { KanbanItem } from "@/types/agent"
import { kanbanStatusKey } from "./kanban-lane"

export function KanbanDetailHeader({
  item,
  busy,
  onViewLogs,
  onDeleted,
}: {
  item: KanbanItem
  busy: boolean
  onViewLogs: (sessionId: string) => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  return (
    <PageHeader
      icon={KanbanSquare}
      title={t("kanban.title")}
      description={`${t(kanbanStatusKey(item.status))} · ${item.agent}`}
      actions={
        <>
          {item.session_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onViewLogs(item.session_id!)}
            >
              <ScrollText className="h-3.5 w-3.5" /> {t("audit.title")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => void handleDelete(item, onDeleted, t)}
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </Button>
        </>
      }
    />
  )
}

async function handleDelete(
  item: KanbanItem,
  onDeleted: () => void,
  t: (key: string, opts?: Record<string, string>) => string
) {
  if (!window.confirm(t("kanban.deleteConfirm", { title: item.title }))) return
  await deleteKanbanItem(item.id)
  onDeleted()
}
