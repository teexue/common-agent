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
import { ScopeFields } from "@/components/manage/skills-dialogs"
import { installSkill } from "@/lib/api"
import type { AgentInfo } from "@/types/agent"

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
  const [url, setUrl] = useState("")
  const [scope, setScope] = useState<"global" | "agent">("global")
  const [agent, setAgent] = useState(() => agents[0]?.id || agents[0]?.name || "")
  const [overwrite, setOverwrite] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={t("manage.skillsInstallUrl")}
        />
        <p className="text-[11px] text-muted-foreground">{t("manage.skillsInstallHint")}</p>
      </div>
      <ScopeFields
        scope={scope}
        agent={agent}
        agents={agents}
        onScopeChange={setScope}
        onAgentChange={setAgent}
      />
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
        <span className="text-xs text-foreground">{t("manage.skillsOverwrite")}</span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 gap-1.5 rounded-xl text-xs"
          disabled={installing || !url.trim() || (scope === "agent" && !agent)}
        >
          {installing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("manage.skillsInstall")}
        </Button>
      </div>
    </form>
  )
}

/** Dialog for installing skills from a remote URL. */
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
      <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
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
