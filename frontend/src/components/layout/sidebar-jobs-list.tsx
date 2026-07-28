import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { History, Pause, Play, Plus, Timer, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { JobsCreateForm } from "@/components/manage/jobs-create-form"
import { JobsRunsDialog } from "@/components/manage/jobs-runs-dialog"
import {
  deleteJob,
  fetchAgents,
  fetchJobs,
  pauseJob,
  resumeJob,
  runJobNow,
} from "@/lib/api"
import type { AgentInfo, JobInfo } from "@/types/agent"

function scheduleShort(job: JobInfo): string {
  if (job.schedule.type === "cron") return job.schedule.cron || "cron"
  if (job.schedule.type === "interval") return job.schedule.interval || "interval"
  return job.schedule.type
}

function JobActionBtn({
  tooltip,
  onClick,
  children,
  disabled,
}: {
  tooltip: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClick}
            disabled={disabled}
            className="h-5 w-5 rounded-md"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function JobListItem({
  job,
  busy,
  agentLabel,
  onPause,
  onResume,
  onRun,
  onRuns,
  onDelete,
  onOpen,
}: {
  job: JobInfo
  busy: boolean
  agentLabel: string
  onPause: () => void
  onResume: () => void
  onRun: () => void
  onRuns: () => void
  onDelete: () => void
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            job.status.running
              ? "bg-primary animate-pulse"
              : job.enabled
                ? "bg-primary/60"
                : "bg-muted-foreground/30"
          }`}
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{job.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {agentLabel} · {scheduleShort(job)}
            {!job.enabled ? ` · ${t("manage.jobsPaused")}` : ""}
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {job.enabled ? (
          <JobActionBtn tooltip={t("manage.jobsPause")} disabled={busy} onClick={(e) => { e.stopPropagation(); onPause() }}>
            <Pause className="h-3 w-3 text-muted-foreground" />
          </JobActionBtn>
        ) : (
          <JobActionBtn tooltip={t("manage.jobsResume")} disabled={busy} onClick={(e) => { e.stopPropagation(); onResume() }}>
            <Play className="h-3 w-3 text-muted-foreground" />
          </JobActionBtn>
        )}
        <JobActionBtn tooltip={t("manage.jobsRunNow")} disabled={busy} onClick={(e) => { e.stopPropagation(); onRun() }}>
          <Zap className="h-3 w-3 text-muted-foreground" />
        </JobActionBtn>
        <JobActionBtn tooltip={t("manage.jobsRunsTitle")} disabled={busy} onClick={(e) => { e.stopPropagation(); onRuns() }}>
          <History className="h-3 w-3 text-muted-foreground" />
        </JobActionBtn>
        <JobActionBtn tooltip={t("common.delete")} disabled={busy} onClick={(e) => { e.stopPropagation(); onDelete() }}>
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </JobActionBtn>
      </div>
    </div>
  )
}

/** Compact jobs section for the sidebar (above session history). */
export function SidebarJobsList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [busyId, setBusyId] = useState("")
  const [creating, setCreating] = useState(false)
  const [runsJob, setRunsJob] = useState<JobInfo | null>(null)

  const reload = useCallback(async () => {
    try {
      const [j, a] = await Promise.all([fetchJobs(), fetchAgents()])
      setJobs(j ?? [])
      setAgents(a ?? [])
    } catch {
      setJobs([])
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => { void reload() }, 15_000)
    return () => window.clearInterval(timer)
  }, [reload])

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    try {
      await fn()
      await reload()
    } catch (err) {
      console.error("Job action failed:", err)
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="p-2.5 pb-0">
      <div className="mb-2 flex items-center gap-1.5 px-2">
        <Timer className="h-3 w-3 text-muted-foreground/70" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {t("layout.jobs")}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 rounded-md"
                onClick={() => setCreating(true)}
              />
            }
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="right">{t("manage.jobsCreate")}</TooltipContent>
        </Tooltip>
      </div>

      {jobs.length === 0 ? (
        <p className="px-2 pb-2 text-[10px] text-muted-foreground/70">{t("manage.jobsEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-0.5 pb-2">
          {jobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              busy={busyId === job.id}
              agentLabel={agents.find((a) => a.id === job.agent || a.name === job.agent)?.name ?? job.agent}
              onPause={() => void withBusy(job.id, async () => { await pauseJob(job.id) })}
              onResume={() => void withBusy(job.id, async () => { await resumeJob(job.id) })}
              onRun={() => void withBusy(job.id, async () => { await runJobNow(job.id) })}
              onRuns={() => setRunsJob(job)}
              onDelete={() => {
                if (!window.confirm(t("manage.jobsDeleteConfirm", { name: job.name }))) return
                void withBusy(job.id, async () => { await deleteJob(job.id) })
              }}
              onOpen={
                job.session_id
                  ? () => navigate(`/agents/${encodeURIComponent(job.agent)}?resume=${encodeURIComponent(job.session_id!)}`)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <JobsRunsDialog
        job={runsJob}
        open={runsJob !== null}
        onOpenChange={(o) => {
          if (!o) setRunsJob(null)
        }}
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>{t("manage.jobsCreateTitle")}</DialogTitle>
          </DialogHeader>
          <JobsCreateForm
            agents={agents}
            hideTitle
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false)
              void reload()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
