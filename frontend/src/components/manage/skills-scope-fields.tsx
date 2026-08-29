import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AgentInfo } from "@/types/agent"

export function ScopeFields({
  scope,
  agent,
  agents,
  onScopeChange,
  onAgentChange,
}: {
  scope: "global" | "agent"
  agent: string
  agents: AgentInfo[]
  onScopeChange: (scope: "global" | "agent") => void
  onAgentChange: (agent: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ScopeSelect
        scope={scope}
        onScopeChange={onScopeChange}
        globalLabel={t("manage.skillsScopeGlobal")}
        agentLabel={t("manage.skillsScopeAgent")}
        fieldLabel={t("manage.skillsFieldScope")}
      />
      {scope === "agent" && (
        <AgentSelect
          agent={agent}
          agents={agents}
          onAgentChange={onAgentChange}
        />
      )}
    </div>
  )
}

function ScopeSelect({
  scope,
  onScopeChange,
  globalLabel,
  agentLabel,
  fieldLabel,
}: {
  scope: "global" | "agent"
  onScopeChange: (scope: "global" | "agent") => void
  globalLabel: string
  agentLabel: string
  fieldLabel: string
}) {
  const scopeOptions = [
    { value: "global", label: globalLabel },
    { value: "agent", label: agentLabel },
  ]
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{fieldLabel}</Label>
      <Select
        value={{
          value: scope,
          label: scopeOptions.find((o) => o.value === scope)?.label ?? scope,
        }}
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v) {
            onScopeChange((v as { value: string }).value as "global" | "agent")
          }
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {scopeOptions.map((o) => (
            <SelectItem key={o.value} value={o}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AgentSelect({
  agent,
  agents,
  onAgentChange,
}: {
  agent: string
  agents: AgentInfo[]
  onAgentChange: (agent: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Agent</Label>
      <Select
        value={
          agent
            ? {
                value: agent,
                label:
                  agents.find((a) => (a.id || a.name) === agent)?.name ?? agent,
              }
            : null
        }
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v) {
            onAgentChange((v as { value: string }).value)
          }
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {agents.map((a) => (
            <SelectItem
              key={a.id || a.name}
              value={{ value: a.id || a.name, label: a.name }}
            >
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
