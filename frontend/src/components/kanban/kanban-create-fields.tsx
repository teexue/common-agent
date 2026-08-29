import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { KanbanCreateFieldsState } from "./kanban-create-submit"
import { KanbanAgentPriority } from "./kanban-agent-priority"

export function KanbanCreateFields({
  form,
}: {
  form: KanbanCreateFieldsState
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("kanban.fieldTitle")}
        </Label>
        <Input
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          required
          className="h-9 rounded-xl text-sm"
          placeholder={t("kanban.titlePlaceholder")}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("kanban.fieldPrompt")}
        </Label>
        <Textarea
          value={form.prompt}
          onChange={(e) => form.setPrompt(e.target.value)}
          required
          rows={5}
          className="resize-none rounded-xl text-sm"
          placeholder={t("kanban.promptPlaceholder")}
        />
      </div>
      <KanbanAgentPriority form={form} />
    </>
  )
}
