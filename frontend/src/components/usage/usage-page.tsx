import { useTranslation } from "react-i18next"
import { Coins } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { UsagePanel } from "./usage-panel"

/** Standalone route wrapper for the token usage report. */
export function UsagePage() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <PageHeader icon={Coins} title={t("usage.title")} />
      <PageMain contentClassName="flex flex-col gap-2">
        <UsagePanel />
      </PageMain>
    </PageShell>
  )
}
