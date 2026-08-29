import { useTranslation } from "react-i18next"
import { ChevronDown, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface KanbanCreateMoreState {
  showMore: boolean
  setShowMore: React.Dispatch<React.SetStateAction<boolean>>
  workdir: string
  setWorkdir: (v: string) => void
  tags: string
  setTags: (v: string) => void
  dueAt: string
  setDueAt: (v: string) => void
  setPickerOpen: (v: boolean) => void
}

export function KanbanCreateMore({ form }: { form: KanbanCreateMoreState }) {
  const { t } = useTranslation()
  return (
    <>
      <button
        type="button"
        onClick={() => form.setShowMore((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            form.showMore && "rotate-180"
          )}
        />
        {t("kanban.moreOptions")}
      </button>
      {form.showMore && <MoreOptionsFields form={form} />}
    </>
  )
}

function MoreOptionsFields({ form }: { form: KanbanCreateMoreState }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("kanban.fieldWorkdir")}
        </Label>
        <div className="flex gap-1.5">
          <Input
            value={form.workdir}
            onChange={(e) => form.setWorkdir(e.target.value)}
            className="h-8 rounded-lg bg-card font-mono text-xs"
            placeholder={t("kanban.workdirPlaceholder")}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="h-8 w-8 shrink-0"
            onClick={() => form.setPickerOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("kanban.fieldTags")}
          </Label>
          <Input
            value={form.tags}
            onChange={(e) => form.setTags(e.target.value)}
            className="h-8 rounded-lg bg-card text-xs"
            placeholder={t("kanban.tagsPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("kanban.fieldDueAt")}
          </Label>
          <Input
            type="date"
            value={form.dueAt}
            onChange={(e) => form.setDueAt(e.target.value)}
            className="h-8 rounded-lg bg-card text-xs"
          />
        </div>
      </div>
    </div>
  )
}
