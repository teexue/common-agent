import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, MessageSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityEntry } from "@/components/conversation/activity-entry"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { eventsToEntries } from "@/hooks/chat-replay"
import { fetchSessionReplay } from "@/lib/api"
import type { ReplayEvent } from "@/types/agent"

/** Cheap change detection for polling: same length + same tail event means
 * nothing new arrived. */
function sameRecords(a: ReplayEvent[] | null, b: ReplayEvent[]): boolean {
  if (a === null || a.length !== b.length) return false
  if (a.length === 0) return true
  const tail = a[a.length - 1]
  const other = b[b.length - 1]
  return tail.ts === other.ts && tail.event?.type === other.event?.type
}

interface SessionConversationProps {
  sessionId: string
  /** User prompt shown as the first message, when known. */
  prompt?: string
  /** Poll for new events to follow an ongoing run. */
  live?: boolean
}

/** Chat-style conversation view of a session's run events. Identical
 * rendering to the workspace conversation: live while running, a complete
 * record once finished. */
export function SessionConversation({
  sessionId,
  prompt,
  live,
}: SessionConversationProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<ReplayEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const load = () => {
      fetchSessionReplay(sessionId)
        .then((recs) => {
          if (cancelled) return
          // Skip no-op updates so the view doesn't re-render on every poll.
          setRecords((prev) => (sameRecords(prev, recs) ? prev : recs))
          setError(null)
          // Stop polling once the run has ended — nothing more will arrive.
          const lastType = recs[recs.length - 1]?.event?.type
          if (
            (lastType === "done" || lastType === "error") &&
            timer !== undefined
          ) {
            clearInterval(timer)
            timer = undefined
          }
        })
        .catch((err) => {
          if (!cancelled)
            setError(err instanceof Error ? err.message : String(err))
        })
    }
    load()
    if (!live)
      return () => {
        cancelled = true
      }
    timer = window.setInterval(load, 2500)
    return () => {
      cancelled = true
      if (timer !== undefined) clearInterval(timer)
    }
  }, [sessionId, live])

  const entries = useMemo(
    () => eventsToEntries(records ?? [], prompt),
    [records, prompt]
  )
  const { containerRef, handleScroll } = useAutoScroll(entries, "auto")

  if (error) {
    return (
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </p>
    )
  }
  if (records === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">{t("replay.noEvents")}</p>
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex h-full flex-col gap-5 overflow-auto p-4"
      >
        {entries.map((entry, i) => (
          <ActivityEntry
            key={entry.id}
            entry={entry}
            selectedToolCallId={null}
            onSelectToolCall={() => {}}
            isActive={!!live && i === entries.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

interface SessionConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
  title?: string
  prompt?: string
  live?: boolean
}

/** Dialog wrapper around SessionConversation. */
export function SessionConversationDialog({
  open,
  onOpenChange,
  sessionId,
  title,
  prompt,
  live,
}: SessionConversationDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="truncate">{title || t("replay.title")}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] overflow-hidden rounded-xl border border-border bg-background">
          {sessionId ? (
            <SessionConversation
              sessionId={sessionId}
              prompt={prompt}
              live={live}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {t("kanban.waitingStart")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
