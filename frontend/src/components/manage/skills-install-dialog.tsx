import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScopeFields } from "@/components/manage/skills-scope-fields"
import { installSkill } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import type { AgentInfo } from "@/types/agent"

export function SkillInstallDialog({
  open,
  agents,
  onOpenChange,
  onInstalled,
}: {
  open: boolean
  agents: AgentInfo[]
  onOpenChange: (open: boolean) => void
  onInstalled: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("manage.skillsInstall")}</DialogTitle>
        </DialogHeader>
        {open && (
          <SkillInstallForm
            agents={agents}
            onCancel={() => onOpenChange(false)}
            onInstalled={() => {
              onOpenChange(false)
              onInstalled()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SkillInstallForm({
  agents,
  onCancel,
  onInstalled,
}: {
  agents: AgentInfo[]
  onCancel: () => void
  onInstalled: () => void
}) {
  const { t } = useTranslation()
  const form = useInstallForm(agents)
  return (
    <form
      onSubmit={(e) => void form.submit(e, onInstalled)}
      onKeyDown={(e) => {
        if (isComposingEvent(e)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <InstallUrlField url={form.url} setUrl={form.setUrl} />
      <ScopeFields
        scope={form.scope}
        agent={form.agent}
        agents={agents}
        onScopeChange={form.setScope}
        onAgentChange={form.setAgent}
      />
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={form.overwrite}
          onChange={(e) => form.setOverwrite(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
        <span className="text-xs text-foreground">
          {t("manage.skillsOverwrite")}
        </span>
      </label>
      {form.error && <p className="text-xs text-destructive">{form.error}</p>}
      <InstallFormActions
        installing={form.installing}
        disabled={!form.url.trim() || (form.scope === "agent" && !form.agent)}
        onCancel={onCancel}
      />
    </form>
  )
}

function InstallUrlField({
  url,
  setUrl,
}: {
  url: string
  setUrl: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">URL</Label>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="h-9 rounded-lg font-mono text-sm"
        placeholder={t("manage.skillsInstallUrl")}
      />
      <p className="text-[11px] text-muted-foreground">
        {t("manage.skillsInstallHint")}
      </p>
    </div>
  )
}

function InstallFormActions({
  installing,
  disabled,
  onCancel,
}: {
  installing: boolean
  disabled: boolean
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={onCancel}
      >
        {t("common.cancel")}
      </Button>
      <Button
        type="submit"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={installing || disabled}
      >
        {installing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("manage.skillsInstall")}
      </Button>
    </div>
  )
}

function useInstallForm(agents: AgentInfo[]) {
  const [url, setUrl] = useState("")
  const [scope, setScope] = useState<"global" | "agent">("global")
  const [agent, setAgent] = useState(
    () => agents[0]?.id || agents[0]?.name || ""
  )
  const [overwrite, setOverwrite] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent, onInstalled: () => void) => {
    e.preventDefault()
    setError("")
    setInstalling(true)
    try {
      await installSkill({
        url: url.trim(),
        scope,
        agent: scope === "agent" ? agent : undefined,
        overwrite,
      })
      onInstalled()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInstalling(false)
    }
  }

  return {
    url,
    setUrl,
    scope,
    setScope,
    agent,
    setAgent,
    overwrite,
    setOverwrite,
    installing,
    error,
    submit,
  }
}
