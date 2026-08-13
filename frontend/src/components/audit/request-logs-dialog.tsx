import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/shared/empty-state"
import { RequestLogRow } from "./request-logs-list"
import { fetchRequestLogs } from "@/lib/api"
import type { RequestLogRecord } from "@/types/agent"

interface RequestLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, only records of this session are shown. */
  sessionId?: string
}

/** Session-scoped viewer for audited LLM request/response records. The
 * global viewer lives on the request logs page. */
export function RequestLogsDialog({
  open,
  onOpenChange,
  sessionId,
}: RequestLogsDialogProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<RequestLogRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const recs = await fetchRequestLogs({ sessionId, limit: 50 })
      setRecords(recs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [sessionId])

  useEffect(() => {
    if (!open) return
    const kickoff = window.setTimeout(() => {
      setRecords(null)
      void load()
    }, 0)
    return () => window.clearTimeout(kickoff)
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4 text-primary" />
            {t("audit.title")}
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 rounded-md"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="flex flex-col gap-2 pr-3">
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            {records === null && !error && (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {records !== null && records.length === 0 && (
              <EmptyState title={t("audit.empty")} />
            )}
            {records?.map((rec, i) => (
              <RequestLogRow key={`${rec.ts}-${i}`} rec={rec} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
