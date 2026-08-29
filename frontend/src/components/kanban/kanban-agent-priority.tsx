import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { KanbanCreateFieldsState } from "./kanban-create-submit"

const PRIORITIES = [1, 2, 3] as const

export function KanbanAgentPriority({
  form,
}: {
  form: KanbanCreateFieldsState
}) {
  const { t } = useTranslation()
  const agentOptions = form.agents.map((a) => ({
    value: a.id || a.name,
    label: a.name,
  }))
  return (
    <div className="flex items-end gap-3">
      <AgentSelect
        agent={form.agent}
        options={agentOptions}
        onChange={form.setAgent}
      />
      <PriorityToggle
        priority={form.priority}
        onChange={form.setPriority}
        labels={{
          1: t("kanban.priorityLow"),
          2: t("kanban.priorityMedium"),
          3: t("kanban.priorityHigh"),
        }}
      />
    </div>
  )
}

function AgentSelect({
  agent,
  options,
  onChange,
}: {
  agent: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("kanban.fieldAgent")}
      </Label>
      <Select
        value={
          agent
            ? {
                value: agent,
                label: options.find((o) => o.value === agent)?.label ?? agent,
              }
            : null
        }
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v)
            onChange((v as { value: string }).value)
        }}
      >
        <SelectTrigger className="h-8 rounded-xl text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map((o) => (
            <SelectItem key={o.value} value={o}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PriorityToggle({
  priority,
  onChange,
  labels,
}: {
  priority: number
  onChange: (v: number) => void
  labels: Record<number, string>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {t("kanban.fieldPriority")}
      </Label>
      <div className="flex h-8 items-center rounded-xl border border-border p-0.5">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "h-full rounded-lg px-3 text-xs transition-colors",
              priority === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {labels[p]}
          </button>
        ))}
      </div>
    </div>
  )
}
