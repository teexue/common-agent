import { useTranslation } from "react-i18next"
import { GitBranch, Loader2 } from "lucide-react"
import { Link } from "react-router"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { ConversationThread } from "@/components/conversation/conversation-thread"
import { useSessionTranscript } from "./use-session-transcript"

export function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const { session, messages, error } = useSessionTranscript(sessionId, true)
  const parentId = session?.metadata?.parent_session

  if (error && !session) {
    return (
      <PageShell>
        <PageHeader icon={GitBranch} title={t("subAgent.title")} />
        <PageMain contentClassName="mx-auto max-w-2xl">
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        </PageMain>
      </PageShell>
    )
  }

  if (!session) {
    return (
      <PageShell>
        <PageHeader icon={GitBranch} title={t("subAgent.title")} />
        <PageMain contentClassName="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </PageMain>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        icon={GitBranch}
        title={session.title || t("subAgent.title")}
        description={session.agent}
        actions={
          parentId ? (
            <Link
              to={`/?session=${encodeURIComponent(parentId)}`}
              className="text-xs text-primary hover:underline"
            >
              {t("subAgent.parentSession")}
            </Link>
          ) : undefined
        }
      />
      <PageMain contentClassName="mx-auto max-w-3xl">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("subAgent.empty")}</p>
        ) : (
          <ConversationThread messages={messages} isStreaming={false} />
        )}
      </PageMain>
    </PageShell>
  )
}
