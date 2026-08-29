import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"
import { ScrollText } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { RequestLogsPanel } from "./request-logs-panel"

/** Standalone route wrapper for the audit log (also embedded in the Admin hub).
 * Supports a `?session=` deep link to pre-filter by session id. */
export function RequestLogsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const session = searchParams.get("session") ?? undefined
  return (
    <PageShell>
      <PageHeader icon={ScrollText} title={t("audit.title")} />
      <PageMain contentClassName="flex flex-col gap-2">
        <RequestLogsPanel key={session ?? "all"} initialSession={session} />
      </PageMain>
    </PageShell>
  )
}
