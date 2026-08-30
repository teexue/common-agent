import { useTranslation } from "react-i18next"
import { Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { InterfaceSection } from "./settings-pref-sections"
import { WorkDirSection } from "./settings-workdir-section"
import { SubagentSection } from "./settings-subagent-section"
import { AppSection, BackgroundSection } from "./settings-info-sections"

/** Personal preference settings: appearance, language, workspace, background, shortcuts, about. */
export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <PageHeader
        icon={Settings}
        title={t("settings.title")}
        description={t("settings.pageDesc")}
      />
      <PageMain contentClassName="mx-auto w-full max-w-3xl space-y-4 pb-10">
        <InterfaceSection />
        <WorkDirSection />
        <SubagentSection />
        <BackgroundSection />
        <AppSection />
      </PageMain>
    </PageShell>
  )
}
