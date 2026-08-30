import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { KanbanEyebrow, KanbanSheet } from "./kanban-sheet"

export interface KanbanCreateMoreState {
  showMore: boolean
  setShowMore: Dispatch<SetStateAction<boolean>>
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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => form.setShowMore((v) => !v)}
        className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            form.showMore && "rotate-180"
          )}
        />
        {t("kanban.moreOptions")}
      </button>
      {form.showMore && (
        <KanbanSheet className="mt-3 space-y-4 py-5">
          <MoreOptionsFields form={form} />
        </KanbanSheet>
      )}
    </div>
  )
}

function MoreOptionsFields({ form }: { form: KanbanCreateMoreState }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <KanbanEyebrow>{t("kanban.fieldWorkdir")}</KanbanEyebrow>
        <div className="flex gap-1.5">
          <Input
            value={form.workdir}
            onChange={(e) => form.setWorkdir(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder={t("kanban.workdirPlaceholder")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-8 w-8 shrink-0"
            onClick={() => form.setPickerOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <KanbanEyebrow>{t("kanban.fieldTags")}</KanbanEyebrow>
          <Input
            value={form.tags}
            onChange={(e) => form.setTags(e.target.value)}
            className="h-8 text-xs"
            placeholder={t("kanban.tagsPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kanban-due" className="sr-only">
            {t("kanban.fieldDueAt")}
          </Label>
          <KanbanEyebrow>{t("kanban.fieldDueAt")}</KanbanEyebrow>
          <Input
            id="kanban-due"
            type="date"
            value={form.dueAt}
            onChange={(e) => form.setDueAt(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </>
  )
}
