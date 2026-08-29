import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import {
  useTheme,
  type ThemeMode,
  type ThemePalette,
} from "@/components/theme-provider"
import { SettingsSection } from "./settings-section"
import { SettingsSelect } from "./settings-select"

export function PaletteSection() {
  const { t } = useTranslation()
  const { palette, setPalette } = useTheme()
  const options = [
    { value: "warm", label: t("settings.paletteWarm") },
    { value: "slate", label: t("settings.paletteSlate") },
  ]
  return (
    <SettingsSection title={t("settings.palette")}>
      <SettingsSelect
        value={palette}
        options={options}
        triggerClassName="w-full rounded-xl"
        onChange={(v) => setPalette(v as ThemePalette)}
      />
    </SettingsSection>
  )
}

export function AppearanceSection() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
    { value: "system", label: t("settings.themeSystem") },
  ]
  return (
    <SettingsSection title={t("settings.appearance")}>
      <SettingsSelect
        value={theme}
        options={options}
        triggerClassName="w-full rounded-xl"
        onChange={(v) => setTheme(v as ThemeMode)}
      />
    </SettingsSection>
  )
}

export function LanguageSection() {
  const { t, i18n: i18nInstance } = useTranslation()
  const currentLang = i18nInstance.language?.startsWith("zh") ? "zh-CN" : "en"
  const options = [
    { value: "zh-CN", label: t("settings.langZh") },
    { value: "en", label: t("settings.langEn") },
  ]
  return (
    <SettingsSection title={t("settings.language")}>
      <SettingsSelect
        value={currentLang}
        options={options}
        triggerClassName="w-full rounded-xl"
        onChange={(v) => {
          void i18n.changeLanguage(v)
        }}
      />
    </SettingsSection>
  )
}
