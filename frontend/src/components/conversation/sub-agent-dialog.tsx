import { useTranslation } from "react-i18next"
import { GitBranch, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConversationThread } from "./conversation-thread"
import { useSessionTranscript } from "@/components/session/use-session-transcript"

export function SubAgentDialog({
  open,
  onOpenChange,
  sessionId,
  live,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId?: string
  live: boolean
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-chart-2" />
            {t("subAgent.title")}
          </DialogTitle>
          <DialogDescription>{t("subAgent.dialogHint")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SubAgentDialogBody sessionId={sessionId} live={live && open} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SubAgentDialogBody({
  sessionId,
  live,
}: {
  sessionId?: string
  live: boolean
}) {
  const { t } = useTranslation()
  if (!sessionId) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("subAgent.starting")}
      </p>
    )
  }
  return <SubAgentTranscript sessionId={sessionId} live={live} />
}

function SubAgentTranscript({
  sessionId,
  live,
}: {
  sessionId: string
  live: boolean
}) {
  const { t } = useTranslation()
  const { session, messages, error } = useSessionTranscript(sessionId, live)
  if (error && !session) {
    return <p className="text-xs text-destructive">{error}</p>
  }
  if (!session) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("subAgent.empty")}</p>
    )
  }
  return <ConversationThread messages={messages} isStreaming={live} />
}
