import { useTranslation } from "react-i18next"
import { Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import {
  AppearanceSection,
  LanguageSection,
  PaletteSection,
} from "./settings-pref-sections"
import { WorkDirSection } from "./settings-workdir-section"
import {
  AboutSection,
  BackgroundSection,
  ShortcutsSection,
} from "./settings-info-sections"

/** Personal preference settings: appearance, language, workspace, background, shortcuts, about. */
export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <PageHeader icon={Settings} title={t("settings.title")} />
      <PageMain contentClassName="w-full space-y-6">
        <PaletteSection />
        <AppearanceSection />
        <LanguageSection />
        <WorkDirSection />
        <BackgroundSection />
        <ShortcutsSection />
        <AboutSection />
      </PageMain>
    </PageShell>
  )
}
