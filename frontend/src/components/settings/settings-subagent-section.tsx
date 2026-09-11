import { useTranslation } from "react-i18next"
import { Bot, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { FormError, FormOk } from "./form-error"
import { SettingsField } from "./settings-field"
import { SettingsSection } from "./settings-section"
import { SettingsToggle } from "./settings-toggle"
import { useSubagentSettings } from "./use-subagent-settings"

export function SubagentSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const s = useSubagentSettings()
  const canSave = user?.role === "admin"
  return (
    <SettingsSection
      title={t("settings.subagent")}
      description={t("settings.subagentHint")}
      icon={<Bot className="h-3.5 w-3.5" />}
      footer={canSave && !s.loading ? <SubagentSave s={s} /> : undefined}
    >
      {s.loading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <SubagentFields s={s} canSave={canSave} />
      )}
    </SettingsSection>
  )
}

function SubagentFields({
  s,
  canSave,
}: {
  s: ReturnType<typeof useSubagentSettings>
  canSave: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <SettingsToggle
        checked={s.form.enabled}
        disabled={!canSave}
        label={t("settings.subagentEnabled")}
        onChange={(enabled) => s.setForm({ ...s.form, enabled })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SubagentNumber
          label={t("settings.subagentMaxTurns")}
          hint={t("settings.subagentMaxTurnsHint")}
          value={s.form.max_turns}
          disabled={!canSave}
          onChange={(n) => s.setForm({ ...s.form, max_turns: n })}
        />
        <SubagentNumber
          label={t("settings.subagentMaxConcurrent")}
          hint={t("settings.subagentMaxConcurrentHint")}
          value={s.form.max_concurrent}
          disabled={!canSave}
          min={1}
          onChange={(n) => s.setForm({ ...s.form, max_concurrent: n })}
        />
        <SubagentNumber
          label={t("settings.subagentTimeout")}
          hint={t("settings.subagentTimeoutHint")}
          value={s.form.timeout}
          disabled={!canSave}
          onChange={(n) => s.setForm({ ...s.form, timeout: n })}
        />
      </div>
      <FormError error={s.error} />
      <FormOk message={s.ok ? t("settings.subagentSaved") : null} />
    </div>
  )
}

function SubagentNumber({
  label,
  hint,
  value,
  disabled,
  min = 0,
  onChange,
}: {
  label: string
  hint: string
  value: number
  disabled: boolean
  min?: number
  onChange: (n: number) => void
}) {
  return (
    <SettingsField label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9 w-full rounded-xl"
      />
    </SettingsField>
  )
}

function SubagentSave({ s }: { s: ReturnType<typeof useSubagentSettings> }) {
  const { t } = useTranslation()
  return (
    <Button
      size="sm"
      className="h-8 gap-1.5 text-xs"
      disabled={s.saving}
      onClick={() => s.save()}
    >
      {s.saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
      {t("common.save")}
    </Button>
  )
}
