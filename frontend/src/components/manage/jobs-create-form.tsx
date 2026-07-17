import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createJob } from "@/lib/api"
import type { AgentInfo } from "@/types/agent"

interface JobsCreateFormProps {
  agents: AgentInfo[]
  onCreated: () => void
  onCancel: () => void
  hideTitle?: boolean
}

/** Form to create a scheduled job. */
export function JobsCreateForm({ agents, onCreated, onCancel, hideTitle }: JobsCreateFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [agent, setAgent] = useState(agents[0]?.id || agents[0]?.name || "")
  const [prompt, setPrompt] = useState("")
  const [workdir, setWorkdir] = useState("")
  const [scheduleType, setScheduleType] = useState<"cron" | "interval">("interval")
  const [cron, setCron] = useState("0 9 * * *")
  const [interval, setIntervalVal] = useState("5m")
  const [sessionMode, setSessionMode] = useState<"new_each_run" | "continue">("continue")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const agentOptions = agents.map((a) => ({ value: a.id || a.name, label: a.name }))
  const scheduleOptions = [
    { value: "interval", label: t("manage.jobsScheduleInterval") },
    { value: "cron", label: t("manage.jobsScheduleCron") },
  ]
  const sessionOptions = [
    { value: "continue", label: t("manage.jobsSessionContinue") },
    { value: "new_each_run", label: t("manage.jobsSessionNew") },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await createJob({
        name: name.trim(),
        agent,
        prompt: prompt.trim(),
        workdir: workdir.trim() || undefined,
        schedule:
          scheduleType === "cron"
            ? { type: "cron", cron: cron.trim() }
            : { type: "interval", interval: interval.trim() },
        session_mode: sessionMode,
        enabled: true,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={hideTitle ? "space-y-3" : "space-y-3 rounded-xl border border-border bg-card p-4"}
    >
      {!hideTitle && (
        <p className="text-sm font-medium text-foreground">{t("manage.jobsCreateTitle")}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.jobsName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-9 rounded-lg text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.jobsAgent")}</Label>
          <Select
            value={agent ? { value: agent, label: agentOptions.find((o) => o.value === agent)?.label ?? agent } : null}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) setAgent((v as { value: string }).value)
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {agentOptions.map((o) => (
                <SelectItem key={o.value} value={o}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("manage.jobsPrompt")}</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={3}
          className="rounded-lg text-sm"
          placeholder={t("manage.jobsPromptPlaceholder")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.jobsScheduleType")}</Label>
          <Select
            value={{ value: scheduleType, label: scheduleOptions.find((o) => o.value === scheduleType)?.label ?? scheduleType }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                setScheduleType((v as { value: string }).value as "cron" | "interval")
              }
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {scheduleOptions.map((o) => (
                <SelectItem key={o.value} value={o}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {scheduleType === "cron" ? t("manage.jobsCron") : t("manage.jobsInterval")}
          </Label>
          {scheduleType === "cron" ? (
            <Input value={cron} onChange={(e) => setCron(e.target.value)} required className="h-9 rounded-lg font-mono text-sm" />
          ) : (
            <Input value={interval} onChange={(e) => setIntervalVal(e.target.value)} required className="h-9 rounded-lg font-mono text-sm" placeholder="5m" />
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.jobsSessionMode")}</Label>
          <Select
            value={{ value: sessionMode, label: sessionOptions.find((o) => o.value === sessionMode)?.label ?? sessionMode }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                setSessionMode((v as { value: string }).value as "new_each_run" | "continue")
              }
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {sessionOptions.map((o) => (
                <SelectItem key={o.value} value={o}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("manage.jobsWorkdir")}</Label>
          <Input
            value={workdir}
            onChange={(e) => setWorkdir(e.target.value)}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder={t("manage.jobsWorkdirPlaceholder")}
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" disabled={saving || !agent}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("common.create")}
        </Button>
      </div>
    </form>
  )
}
