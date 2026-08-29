import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchRequestLogDetail } from "@/lib/api"
import type { RequestLogRecord } from "@/types/agent"

function formatLogTime(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="max-h-56 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function useRequestLogDetail(rec: RequestLogRecord) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<RequestLogRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadDetail = async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await fetchRequestLogDetail(rec.ts, rec.session_id)
      setDetail(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !detail && !loading && !err) void loadDetail()
  }

  return { open, detail, loading, err, toggle }
}

function RequestLogHeader({
  rec,
  open,
}: {
  rec: RequestLogRecord
  open: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <ChevronDown
        className={cn(
          "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-180"
        )}
      />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {formatLogTime(rec.ts)}
      </span>
      {rec.source && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">
          {rec.source}
        </span>
      )}
      {rec.agent && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">
          {rec.agent}
        </span>
      )}
      <span className="truncate font-mono text-[11px]">{rec.model || "—"}</span>
      <span className="flex-1" />
      {rec.session_id && (
        <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
          {rec.session_id}
        </span>
      )}
      {(rec.input_tokens || rec.output_tokens) && (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {rec.input_tokens ?? 0}→{rec.output_tokens ?? 0}
        </span>
      )}
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {rec.duration_ms}ms
      </span>
      {rec.error && (
        <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
          {t("audit.error")}
        </span>
      )}
    </>
  )
}

function RequestLogDetail({
  rec,
  loading,
  err,
  detail,
}: {
  rec: RequestLogRecord
  loading: boolean
  err: string | null
  detail: RequestLogRecord | null
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 border-t border-border/60 px-3 py-2">
      {rec.error && (
        <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {rec.error}
        </p>
      )}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("common.loading")}
        </div>
      )}
      {err && (
        <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {err}
        </p>
      )}
      {detail && (
        <>
          <JsonBlock label={t("audit.request")} value={detail.request} />
          <JsonBlock label={t("audit.response")} value={detail.response} />
        </>
      )}
    </div>
  )
}

/** Expandable log row; request/response payloads load on first expand. */
export function RequestLogRow({ rec }: { rec: RequestLogRecord }) {
  const { open, detail, loading, err, toggle } = useRequestLogDetail(rec)
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        <RequestLogHeader rec={rec} open={open} />
      </button>
      {open && (
        <RequestLogDetail
          rec={rec}
          loading={loading}
          err={err}
          detail={detail}
        />
      )}
    </div>
  )
}
