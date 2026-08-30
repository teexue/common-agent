import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import { Paintbrush } from "lucide-react"
import {
  useTheme,
  type ThemeMode,
  type ThemePalette,
} from "@/components/theme-provider"
import { SettingsRow } from "./settings-field"
import { SettingsSection } from "./settings-section"
import { SettingsSelect } from "./settings-select"

export function InterfaceSection() {
  const { t } = useTranslation()
  return (
    <SettingsSection
      title={t("settings.interface")}
      icon={<Paintbrush className="h-3.5 w-3.5" />}
      padded={false}
    >
      <div className="divide-y divide-border">
        <PaletteRow />
        <AppearanceRow />
        <LanguageRow />
      </div>
    </SettingsSection>
  )
}

function PaletteRow() {
  const { t } = useTranslation()
  const { palette, setPalette } = useTheme()
  return (
    <SettingsRow label={t("settings.palette")}>
      <SettingsSelect
        value={palette}
        options={[
          { value: "warm", label: t("settings.paletteWarm") },
          { value: "slate", label: t("settings.paletteSlate") },
        ]}
        triggerClassName="h-9 w-full rounded-xl"
        onChange={(v) => setPalette(v as ThemePalette)}
      />
    </SettingsRow>
  )
}

function AppearanceRow() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  return (
    <SettingsRow label={t("settings.appearance")}>
      <SettingsSelect
        value={theme}
        options={[
          { value: "light", label: t("settings.themeLight") },
          { value: "dark", label: t("settings.themeDark") },
          { value: "system", label: t("settings.themeSystem") },
        ]}
        triggerClassName="h-9 w-full rounded-xl"
        onChange={(v) => setTheme(v as ThemeMode)}
      />
    </SettingsRow>
  )
}

function LanguageRow() {
  const { t, i18n: i18nInstance } = useTranslation()
  const currentLang = i18nInstance.language?.startsWith("zh") ? "zh-CN" : "en"
  return (
    <SettingsRow label={t("settings.language")}>
      <SettingsSelect
        value={currentLang}
        options={[
          { value: "zh-CN", label: t("settings.langZh") },
          { value: "en", label: t("settings.langEn") },
        ]}
        triggerClassName="h-9 w-full rounded-xl"
        onChange={(v) => {
          void i18n.changeLanguage(v)
        }}
      />
    </SettingsRow>
  )
}
