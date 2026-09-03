import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { RequestLogRow } from "./request-logs-list"
import { RequestLogsFilters } from "./request-logs-filters"
import { fetchRequestLogs } from "@/lib/api"
import type { RequestLogRecord } from "@/types/agent"

function useRequestLogs(source: string, sessionFilter: string) {
  const [records, setRecords] = useState<RequestLogRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const recs = await fetchRequestLogs({
        source: source || undefined,
        sessionId: sessionFilter || undefined,
        limit: 100,
      })
      setRecords(recs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [source, sessionFilter])

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void load()
    }, 0)
    const timer = window.setInterval(() => {
      void load()
    }, 5_000)
    return () => {
      window.clearTimeout(kickoff)
      window.clearInterval(timer)
    }
  }, [load])

  return { records, error, load }
}

function LogsBody({
  records,
  error,
}: {
  records: RequestLogRecord[] | null
  error: string | null
}) {
  const { t } = useTranslation()
  return (
    <>
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
      <div className="space-y-2">
        {records?.map((rec, i) => (
          <RequestLogRow key={`${rec.ts}-${i}`} rec={rec} />
        ))}
      </div>
    </>
  )
}

/** Filterable list of audited LLM requests (no page shell).
 * `initialSession` seeds the session filter (used by deep links like
 * /request-logs?session=...). */
export function RequestLogsPanel({
  initialSession,
}: {
  initialSession?: string
}) {
  const [source, setSource] = useState("")
  const [sessionInput, setSessionInput] = useState(initialSession ?? "")
  const [sessionFilter, setSessionFilter] = useState(initialSession ?? "")
  const { records, error, load } = useRequestLogs(source, sessionFilter)

  return (
    <div className="space-y-3">
      <RequestLogsFilters
        source={source}
        onSourceChange={setSource}
        sessionInput={sessionInput}
        onSessionInput={setSessionInput}
        onApply={() => setSessionFilter(sessionInput.trim())}
        onRefresh={() => void load()}
      />
      <LogsBody records={records} error={error} />
    </div>
  )
}
