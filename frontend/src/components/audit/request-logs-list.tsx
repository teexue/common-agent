import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RequestLogRecord } from "@/types/agent"

export function formatLogTime(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <pre className="max-h-56 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

/** One expandable request log record row, shared by the audit page and the
 * session-scoped dialog. */
export function RequestLogRow({ rec }: { rec: RequestLogRecord }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatLogTime(rec.ts)}</span>
        {rec.source && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{rec.source}</span>}
        {rec.agent && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{rec.agent}</span>}
        <span className="truncate font-mono text-[11px]">{rec.model || "—"}</span>
        <span className="flex-1" />
        {rec.session_id && (
          <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">{rec.session_id}</span>
        )}
        {(rec.input_tokens || rec.output_tokens) && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {rec.input_tokens ?? 0}→{rec.output_tokens ?? 0}
          </span>
        )}
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{rec.duration_ms}ms</span>
        {rec.error && <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">{t("audit.error")}</span>}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2">
          {rec.error && <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{rec.error}</p>}
          <JsonBlock label={t("audit.request")} value={rec.request} />
          <JsonBlock label={t("audit.response")} value={rec.response} />
        </div>
      )}
    </div>
  )
}
