import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import type { KnowledgeDocument } from "@/types/agent"

export function KnowledgeDocumentList({
  docs,
  busy,
  onDeleteDoc,
}: {
  docs: KnowledgeDocument[]
  busy: boolean
  onDeleteDoc: (docId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t("manage.knowledgeDocuments")}
      </p>
      {docs.length === 0 ? (
        <EmptyState title={t("manage.knowledgeDocsEmpty")} />
      ) : (
        docs.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground">{d.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {d.chunk_count} chunks · {(d.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-destructive"
              disabled={busy}
              onClick={() => onDeleteDoc(d.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}
