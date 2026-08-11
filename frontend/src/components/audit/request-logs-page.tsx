import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RequestLogRow } from "./request-logs-list"
import { fetchRequestLogs } from "@/lib/api"
import type { RequestLogRecord } from "@/types/agent"

const SOURCES = ["http", "kanban", "optimize", "cli"] as const

/** Global audit page listing every audited LLM request, with filters. */
export function RequestLogsPage() {
  const { t } = useTranslation()
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
    const kickoff = window.setTimeout(() => { void load() }, 0)
    const timer = window.setInterval(() => { void load() }, 5_000)
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
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <h1 className="font-heading text-base tracking-tight text-foreground">{t("audit.title")}</h1>
        </div>
        <div className="flex-1" />
        <Select
          value={{ value: source, label: sourceOptions.find((o) => o.value === source)?.label ?? source }}
          onValueChange={(v) => {
            if (v && typeof v === "object" && "value" in v) setSource((v as { value: string }).value)
          }}
        >
          <SelectTrigger className="h-8 w-32 rounded-xl text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {sourceOptions.map((o) => (
              <SelectItem key={o.value || "all"} value={o}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSessionFilter(sessionInput.trim()) }}
          placeholder={t("audit.filterSession")}
          className="h-8 w-48 rounded-xl font-mono text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl text-xs"
          onClick={() => setSessionFilter(sessionInput.trim())}
        >
          {t("audit.applyFilter")}
        </Button>
        <Button variant="ghost" size="icon-xs" className="h-8 w-8 rounded-xl" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-6 py-4">
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {records === null && !error && (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {records !== null && records.length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">{t("audit.empty")}</p>
          )}
          {records?.map((rec, i) => <RequestLogRow key={`${rec.ts}-${i}`} rec={rec} />)}
        </div>
      </ScrollArea>
    </div>
  )
}
