import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, FolderOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DirPickerDialog } from "@/components/settings/dir-picker-dialog"
import { createKanbanItem, fetchAgents } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { AgentInfo } from "@/types/agent"

interface KanbanCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const PRIORITIES = [1, 2, 3] as const

/** Dialog form to create a kanban task. Core fields up front; workdir,
 * tags and due date are tucked behind a "more options" toggle. */
export function KanbanCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: KanbanCreateDialogProps) {
  const { t } = useTranslation()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [agent, setAgent] = useState("")
  const [priority, setPriority] = useState(2)
  const [showMore, setShowMore] = useState(false)
  const [workdir, setWorkdir] = useState("")
  const [tags, setTags] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    fetchAgents()
      .then((d) => {
        const list = d ?? []
        setAgents(list)
        setAgent((prev) => prev || list[0]?.id || list[0]?.name || "")
      })
      .catch(() => setAgents([]))
  }, [open])

  const agentOptions = agents.map((a) => ({
    value: a.id || a.name,
    label: a.name,
  }))
  const priorityLabels: Record<number, string> = {
    1: t("kanban.priorityLow"),
    2: t("kanban.priorityMedium"),
    3: t("kanban.priorityHigh"),
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await createKanbanItem({
        title: title.trim(),
        prompt: prompt.trim(),
        agent,
        workdir: workdir.trim() || undefined,
        priority,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        due_at: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : undefined,
      })
      setTitle("")
      setPrompt("")
      setWorkdir("")
      setTags("")
      setDueAt("")
      setShowMore(false)
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("kanban.createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="h-9 rounded-xl text-sm"
            placeholder={t("kanban.titlePlaceholder")}
          />

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={4}
            className="resize-none rounded-xl text-sm"
            placeholder={t("kanban.promptPlaceholder")}
          />

          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("kanban.fieldAgent")}
              </Label>
              <Select
                value={
                  agent
                    ? {
                        value: agent,
                        label:
                          agentOptions.find((o) => o.value === agent)?.label ??
                          agent,
                      }
                    : null
                }
                onValueChange={(v) => {
                  if (v && typeof v === "object" && "value" in v)
                    setAgent((v as { value: string }).value)
                }}
              >
                <SelectTrigger className="h-8 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {agentOptions.map((o) => (
                    <SelectItem key={o.value} value={o}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("kanban.fieldPriority")}
              </Label>
              <div className="flex h-8 items-center rounded-xl border border-border p-0.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "h-full rounded-[10px] px-3 text-xs transition-colors",
                      priority === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {priorityLabels[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showMore && "rotate-180"
              )}
            />
            {t("kanban.moreOptions")}
          </button>

          {showMore && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("kanban.fieldWorkdir")}
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    value={workdir}
                    onChange={(e) => setWorkdir(e.target.value)}
                    className="h-8 rounded-lg bg-card font-mono text-xs"
                    placeholder={t("kanban.workdirPlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    className="h-8 w-8 shrink-0 rounded-lg"
                    onClick={() => setPickerOpen(true)}
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
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
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
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="h-8 rounded-lg bg-card text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-xs"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1.5 rounded-xl text-xs"
              disabled={saving || !agent}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.create")}
            </Button>
          </div>
        </form>

        <DirPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialPath={workdir}
          onSelect={setWorkdir}
        />
      </DialogContent>
    </Dialog>
  )
}
