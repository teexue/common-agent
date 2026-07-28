import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
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
import {
  createSkill,
  fetchSkill,
  updateSkill,
  type SkillPayload,
} from "@/lib/api"
import type { AgentInfo, SkillInfo } from "@/types/agent"

/** Agent Skills standard: lowercase letters/digits/hyphens, ≤64 chars,
 *  no leading/trailing/consecutive hyphens. */
function isValidSkillName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(name) && !name.includes("--")
}

/** Scope selector (global / per-agent) shared by the skill dialogs. */
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
  const scopeOptions = [
    { value: "global", label: t("manage.skillsScopeGlobal") },
    { value: "agent", label: t("manage.skillsScopeAgent") },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldScope")}</Label>
        <Select
          value={{ value: scope, label: scopeOptions.find((o) => o.value === scope)?.label ?? scope }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v) {
              onScopeChange((v as { value: string }).value as "global" | "agent")
            }
          }}
        >
          <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {scopeOptions.map((o) => (
              <SelectItem key={o.value} value={o}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {scope === "agent" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Agent</Label>
          <Select
            value={agent ? { value: agent, label: agents.find((a) => (a.id || a.name) === agent)?.name ?? agent } : null}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                onAgentChange((v as { value: string }).value)
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {agents.map((a) => (
                <SelectItem key={a.id || a.name} value={{ value: a.id || a.name, label: a.name }}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

interface SkillFormState {
  name: string
  description: string
  body: string
  license: string
  allowedTools: string
  scope: "global" | "agent"
  agent: string
}

function initialFormState(mode: "create" | "edit", skill: SkillInfo | null, agents: AgentInfo[]): SkillFormState {
  if (mode === "edit" && skill) {
    return {
      name: skill.name,
      description: skill.description,
      body: "",
      license: "",
      allowedTools: "",
      scope: skill.scope,
      agent: skill.agent ?? "",
    }
  }
  return {
    name: "",
    description: "",
    body: "",
    license: "",
    allowedTools: "",
    scope: "global",
    agent: agents[0]?.id || agents[0]?.name || "",
  }
}

function SkillForm({
  mode,
  skill,
  agents,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit"
  skill: SkillInfo | null
  agents: AgentInfo[]
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<SkillFormState>(() => initialFormState(mode, skill, agents))
  const [detailLoading, setDetailLoading] = useState(mode === "edit" && !!skill)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const set = <K extends keyof SkillFormState>(key: K, value: SkillFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    if (mode !== "edit" || !skill) return
    let cancelled = false
    fetchSkill(skill.name, skill.scope, skill.agent)
      .then((d) => {
        if (cancelled) return
        setForm((f) => ({
          ...f,
          description: d.description,
          body: d.body,
          license: d.license ?? "",
          allowedTools: d.allowed_tools ?? "",
        }))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, skill])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (mode === "create" && !isValidSkillName(form.name.trim())) {
      setError(t("manage.skillsNameInvalid"))
      return
    }
    const payload: SkillPayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      body: form.body,
      license: form.license.trim() || undefined,
      allowed_tools: form.allowedTools.trim() || undefined,
      scope: form.scope,
      agent: form.scope === "agent" ? form.agent : undefined,
    }
    setSaving(true)
    try {
      if (mode === "edit" && skill) await updateSkill(skill.name, payload)
      else await createSkill(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (detailLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("manage.loading")}
      </div>
    )
  }
  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldName")}</Label>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            disabled={mode === "edit"}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="my-skill"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldLicense")}</Label>
          <Input
            value={form.license}
            onChange={(e) => set("license", e.target.value)}
            className="h-9 rounded-lg text-sm"
            placeholder="Apache-2.0"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldDesc")}</Label>
        <Input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          required
          className="h-9 rounded-lg text-sm"
        />
      </div>
      <ScopeFields
        scope={form.scope}
        agent={form.agent}
        agents={agents}
        onScopeChange={(s) => set("scope", s)}
        onAgentChange={(a) => set("agent", a)}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldAllowedTools")}</Label>
        <Input
          value={form.allowedTools}
          onChange={(e) => set("allowedTools", e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="Read Bash(git:*) Write"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("manage.skillsFieldBody")}</Label>
        <Textarea
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          required
          rows={12}
          className="rounded-lg font-mono text-[13px]"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 gap-1.5 rounded-xl text-xs"
          disabled={saving || (form.scope === "agent" && !form.agent)}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </form>
  )
}

/** Create/edit dialog for a skill (name disabled in edit mode). */
export function SkillFormDialog({
  open,
  mode,
  skill,
  agents,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  mode: "create" | "edit"
  skill: SkillInfo | null
  agents: AgentInfo[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? t("manage.skillsEditTitle") : t("manage.skillsCreateTitle")}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <SkillForm
            mode={mode}
            skill={skill}
            agents={agents}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false)
              onSaved()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
