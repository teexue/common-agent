import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { isComposingEvent } from "@/lib/keys"
import type { AgentInfo } from "@/types/agent"
import { ScopeFields } from "./skills-scope-fields"
import type { SkillFormState } from "./use-skill-form"

export function SkillFormFields({
  mode,
  form,
  setField,
  agents,
  error,
  onSubmit,
}: {
  mode: "create" | "edit"
  form: SkillFormState
  setField: <K extends keyof SkillFormState>(
    key: K,
    value: SkillFormState[K]
  ) => void
  agents: AgentInfo[]
  error: string
  onSubmit: (e?: React.FormEvent) => void
}) {
  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (isComposingEvent(e)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <SkillIdentityFields mode={mode} form={form} setField={setField} />
      <ScopeFields
        scope={form.scope}
        agent={form.agent}
        agents={agents}
        onScopeChange={(s) => setField("scope", s)}
        onAgentChange={(a) => setField("agent", a)}
      />
      <SkillBodyFields form={form} setField={setField} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

function SkillIdentityFields({
  mode,
  form,
  setField,
}: {
  mode: "create" | "edit"
  form: SkillFormState
  setField: <K extends keyof SkillFormState>(
    key: K,
    value: SkillFormState[K]
  ) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("manage.skillsFieldName")}
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            disabled={mode === "edit"}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder="my-skill"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("manage.skillsFieldLicense")}
          </Label>
          <Input
            value={form.license}
            onChange={(e) => setField("license", e.target.value)}
            className="h-9 rounded-lg text-sm"
            placeholder="Apache-2.0"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("manage.skillsFieldDesc")}
        </Label>
        <Input
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          required
          className="h-9 rounded-lg text-sm"
        />
      </div>
    </>
  )
}

function SkillBodyFields({
  form,
  setField,
}: {
  form: SkillFormState
  setField: <K extends keyof SkillFormState>(
    key: K,
    value: SkillFormState[K]
  ) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("manage.skillsFieldAllowedTools")}
        </Label>
        <Input
          value={form.allowedTools}
          onChange={(e) => setField("allowedTools", e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="Read Bash(git:*) Write"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("manage.skillsFieldBody")}
        </Label>
        <Textarea
          value={form.body}
          onChange={(e) => setField("body", e.target.value)}
          required
          rows={16}
          className="rounded-lg font-mono text-[13px]"
        />
      </div>
    </>
  )
}
