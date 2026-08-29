import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KanbanSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import { fetchAgents } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import type { AgentInfo } from "@/types/agent"
import { KanbanCreateFields } from "./kanban-create-fields"
import { KanbanCreateMore } from "./kanban-create-more"
import { submitKanbanCreate } from "./kanban-create-submit"

export function KanbanCreatePage({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const form = useKanbanCreate(onCreated)
  return (
    <PageShell>
      <PageHeader
        icon={KanbanSquare}
        title={t("kanban.createTitle")}
        actions={<CreateActions form={form} onBack={onBack} />}
      />
      <PageMain contentClassName="max-w-2xl">
        <form
          onSubmit={(e) => void form.handleSubmit(e)}
          onKeyDown={(e) => {
            if (isComposingEvent(e)) e.preventDefault()
          }}
          className="space-y-4"
        >
          <KanbanCreateFields form={form} />
          <KanbanCreateMore form={form} />
          {form.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {form.error}
            </p>
          )}
        </form>
        <DirPickerDialog
          open={form.pickerOpen}
          onOpenChange={form.setPickerOpen}
          initialPath={form.workdir}
          onSelect={form.setWorkdir}
        />
      </PageMain>
    </PageShell>
  )
}

function CreateActions({
  form,
  onBack,
}: {
  form: ReturnType<typeof useKanbanCreate>
  onBack: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={onBack}
      >
        {t("common.cancel")}
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={form.saving || !form.agent}
        onClick={() => void form.handleSubmit()}
      >
        {form.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("common.create")}
      </Button>
    </>
  )
}

function useKanbanCreate(onCreated: () => void) {
  const core = useKanbanCore()
  const extra = useKanbanExtra()
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    return submitKanbanCreate({
      title: core.title,
      prompt: core.prompt,
      agent: core.agent,
      workdir: extra.workdir,
      priority: core.priority,
      tags: extra.tags,
      dueAt: extra.dueAt,
      onCreated,
      setError: extra.setError,
      setSaving: extra.setSaving,
    })
  }
  return { ...core, ...extra, handleSubmit }
}

function useKanbanCore() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [agent, setAgent] = useState("")
  const [priority, setPriority] = useState(2)
  useEffect(() => {
    fetchAgents()
      .then((d) => {
        const list = d ?? []
        setAgents(list)
        setAgent((prev) => prev || list[0]?.id || list[0]?.name || "")
      })
      .catch(() => setAgents([]))
  }, [])
  return {
    agents,
    title,
    setTitle,
    prompt,
    setPrompt,
    agent,
    setAgent,
    priority,
    setPriority,
  }
}

function useKanbanExtra() {
  const [showMore, setShowMore] = useState(false)
  const [workdir, setWorkdir] = useState("")
  const [tags, setTags] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  return {
    showMore,
    setShowMore,
    workdir,
    setWorkdir,
    tags,
    setTags,
    dueAt,
    setDueAt,
    pickerOpen,
    setPickerOpen,
    saving,
    error,
    setError,
    setSaving,
  }
}
