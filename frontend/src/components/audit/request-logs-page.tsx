import { useTranslation } from "react-i18next"
import { ScrollText } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { RequestLogsPanel } from "./request-logs-panel"

/** Standalone route wrapper for the audit log (also embedded in the Admin hub). */
export function RequestLogsPage() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <PageHeader
        icon={ScrollText}
        title={t("audit.title")}
      />
      <PageMain contentClassName="flex flex-col gap-2">
        <RequestLogsPanel />
      </PageMain>
    </PageShell>
  )
}
