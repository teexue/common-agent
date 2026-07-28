import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { fetchJobRuns } from "@/lib/api"
import { truncate } from "@/lib/format"
import type { JobInfo, JobRunRecord } from "@/types/agent"

function runStatusKey(status: string): string {
  if (status === "ok") return "manage.jobsRunsStatusOk"
  if (status === "skipped") return "manage.jobsRunsStatusSkipped"
  return "manage.jobsRunsStatusError"
}

function runDotClass(status: string): string {
  if (status === "ok") return "bg-primary"
  if (status === "skipped") return "bg-muted-foreground/40"
  return "bg-destructive"
}

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "-"
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function RunRow({ run, onOpen }: { run: JobRunRecord; onOpen?: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left",
        onOpen
          ? "transition-colors hover:bg-accent"
          : "cursor-default text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          runDotClass(run.status)
        )}
      />
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium">
          {t(runStatusKey(run.status))}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {new Date(run.started_at).toLocaleString()} ·{" "}
          {formatDuration(run.started_at, run.ended_at)}
          {run.error ? ` · ${truncate(run.error, 80)}` : ""}
        </span>
      </div>
    </button>
  )
}

function RunsList({
  job,
  onOpenChange,
}: {
  job: JobInfo
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<JobRunRecord[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetchJobRuns(job.id)
      .then((r) => {
        if (!cancelled) setRuns(r ?? [])
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [job.id])

  if (error) return <p className="py-4 text-xs text-destructive">{error}</p>
  if (runs === null) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("manage.loading")}
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <p className="py-4 text-xs text-muted-foreground">
        {t("manage.jobsRunsEmpty")}
      </p>
    )
  }
  return (
    <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
      {runs.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          onOpen={
            run.session_id
              ? () => {
                  onOpenChange(false)
                  navigate(
                    `/agents/${encodeURIComponent(job.agent)}?resume=${encodeURIComponent(run.session_id!)}`
                  )
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}

/** Dialog listing recent run records of a scheduled job. */
export function JobsRunsDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>
            {t("manage.jobsRunsTitle")}
            {job ? ` · ${job.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        {open && job ? (
          <RunsList job={job} onOpenChange={onOpenChange} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
