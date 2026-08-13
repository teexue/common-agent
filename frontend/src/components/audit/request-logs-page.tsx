import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageMain, PageShell } from "@/components/shared/page-shell"
import { RequestLogRow } from "./request-logs-list"
import { fetchRequestLogs } from "@/lib/api"
import type { RequestLogRecord } from "@/types/agent"

const SOURCES = ["http", "kanban", "optimize", "cli"] as const

/** Global audit page listing every audited LLM request, with filters. */
export function RequestLogsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [records, setRecords] = useState<RequestLogRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState("")
  const [sessionInput, setSessionInput] = useState("")
  const [sessionFilter, setSessionFilter] = useState("")

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

  const sourceOptions = [
    { value: "", label: t("audit.sourceAll") },
    ...SOURCES.map((s) => ({ value: s, label: s })),
  ]

  return (
    <PageShell>
      <PageHeader
        icon={ScrollText}
        title={t("audit.title")}
        onBack={() => navigate(-1)}
      />

      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <Select
          value={{
            value: source,
            label:
              sourceOptions.find((o) => o.value === source)?.label ?? source,
          }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v)
              setSource((v as { value: string }).value)
          }}
        >
          <SelectTrigger className="h-8 w-32 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {sourceOptions.map((o) => (
              <SelectItem key={o.value || "all"} value={o}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSessionFilter(sessionInput.trim())
          }}
          placeholder={t("audit.filterSession")}
          className="h-8 w-48 rounded-xl font-mono text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setSessionFilter(sessionInput.trim())}
        >
          {t("audit.applyFilter")}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-8 w-8"
          onClick={() => void load()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <PageMain contentClassName="flex flex-col gap-2">
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
      </PageMain>
    </PageShell>
  )
}
