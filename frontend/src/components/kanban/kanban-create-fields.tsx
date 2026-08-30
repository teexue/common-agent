import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { KanbanCreateFieldsState } from "./kanban-create-submit"
import { KanbanAgentPriority } from "./kanban-agent-priority"
import { KanbanEyebrow, KanbanSheet } from "./kanban-sheet"

export function KanbanCreateFields({
  form,
}: {
  form: KanbanCreateFieldsState
}) {
  const { t } = useTranslation()
  return (
    <KanbanSheet className="space-y-7">
      <div>
        <Label htmlFor="kanban-title" className="sr-only">
          {t("kanban.fieldTitle")}
        </Label>
        <Input
          id="kanban-title"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          required
          className="h-auto rounded-none border-0 bg-transparent px-0 py-1 font-heading text-2xl shadow-none placeholder:text-muted-foreground/40 focus-visible:border-transparent focus-visible:ring-0"
          placeholder={t("kanban.titlePlaceholder")}
        />
      </div>
      <div>
        <KanbanEyebrow>{t("kanban.fieldPrompt")}</KanbanEyebrow>
        <Label htmlFor="kanban-prompt" className="sr-only">
          {t("kanban.fieldPrompt")}
        </Label>
        <Textarea
          id="kanban-prompt"
          value={form.prompt}
          onChange={(e) => form.setPrompt(e.target.value)}
          required
          rows={8}
          className="mt-2 min-h-40 rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-7 shadow-none placeholder:text-muted-foreground/40 focus-visible:border-transparent focus-visible:ring-0"
          placeholder={t("kanban.promptPlaceholder")}
        />
      </div>
      <div className="border-t border-border/50 pt-5">
        <KanbanAgentPriority form={form} />
      </div>
    </KanbanSheet>
  )
}
