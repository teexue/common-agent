import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Loader2, Save, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { FormError, FormOk } from "./form-error"
import { SettingsSection } from "./settings-section"
import { SettingsSelect } from "./settings-select"
import { useShellSettings, type ShellInfo } from "./use-shell-settings"

export function ShellSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const s = useShellSettings()
  const canSave = user?.role === "admin"
  return (
    <SettingsSection
      title={t("settings.shell")}
      description={t("settings.shellHint")}
      icon={<Terminal className="h-3.5 w-3.5" />}
      footer={
        canSave && s.view.selectable && !s.loading ? (
          <ShellSave s={s} />
        ) : undefined
      }
    >
      {s.loading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <ShellFields s={s} canSave={canSave} />
      )}
    </SettingsSection>
  )
}

function ShellFields({
  s,
  canSave,
}: {
  s: ReturnType<typeof useShellSettings>
  canSave: boolean
}) {
  const { t } = useTranslation()
  if (s.error && s.view.available.length === 0) {
    return <FormError error={s.error} />
  }
  if (!s.view.selectable) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("settings.shellUnixHint")}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <SettingsSelect
        value={s.shell}
        disabled={!canSave}
        options={shellOptions(s.view.available, t)}
        triggerClassName="h-9 w-full rounded-xl"
        onChange={s.setShell}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.shellResolved", {
          name: s.view.resolved.name,
          path: s.view.resolved.path,
        })}
      </p>
      <FormError error={s.error} />
      <FormOk message={s.ok ? t("settings.shellSaved") : null} />
    </div>
  )
}

function shellOptions(
  available: ShellInfo[],
  t: TFunction
): { value: string; label: string }[] {
  const named = available.map((sh) => ({
    value: sh.id,
    label: t(`settings.shellName_${sh.id}`),
  }))
  return [{ value: "auto", label: t("settings.shellAuto") }, ...named]
}

function ShellSave({ s }: { s: ReturnType<typeof useShellSettings> }) {
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
