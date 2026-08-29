import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SkillInstallDialog } from "@/components/manage/skills-install-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { deleteSkill } from "@/lib/api"
import type { AgentInfo, SkillInfo } from "@/types/agent"
import { SkillCard } from "./skill-card"

interface SkillsPanelProps {
  skills: SkillInfo[]
  loading: boolean
  agents: AgentInfo[]
  onRefresh: () => void
  onEditSkill?: (skill: SkillInfo) => void
  onCreateSkill?: () => void
}

export function SkillsPanel({
  skills,
  loading,
  agents,
  onRefresh,
  onEditSkill,
  onCreateSkill,
}: SkillsPanelProps) {
  const { t } = useTranslation()
  const [installOpen, setInstallOpen] = useState(false)
  const [error, setError] = useState("")
  const groups = groupSkills(skills, t("manage.skillsGlobalGroup"))

  return (
    <div className="space-y-3">
      <SkillsPanelHeader
        onCreateSkill={onCreateSkill}
        onInstall={() => setInstallOpen(true)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <SkillsGroupList
        loading={loading}
        skills={skills}
        groups={groups}
        onEditSkill={onEditSkill}
        onDelete={(skill) => void handleDelete(skill, t, setError, onRefresh)}
      />
      <SkillInstallDialog
        open={installOpen}
        agents={agents}
        onOpenChange={setInstallOpen}
        onInstalled={onRefresh}
      />
    </div>
  )
}

function SkillsPanelHeader({
  onCreateSkill,
  onInstall,
}: {
  onCreateSkill?: () => void
  onInstall: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] text-muted-foreground">
        {t("manage.skillsHint")}
      </p>
      <div className="flex gap-2">
        {onCreateSkill && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onCreateSkill}
          >
            <Plus className="h-3.5 w-3.5" /> {t("manage.skillsCreate")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onInstall}
        >
          <Download className="h-3.5 w-3.5" /> {t("manage.skillsInstall")}
        </Button>
      </div>
    </div>
  )
}

function SkillsGroupList({
  loading,
  skills,
  groups,
  onEditSkill,
  onDelete,
}: {
  loading: boolean
  skills: SkillInfo[]
  groups: { key: string; label: string; items: SkillInfo[] }[]
  onEditSkill?: (skill: SkillInfo) => void
  onDelete: (skill: SkillInfo) => void
}) {
  const { t } = useTranslation()
  if (loading) return <EmptyState title={t("manage.loading")} />
  if (skills.length === 0) return <EmptyState title={t("manage.skillsEmpty")} />
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((sk) => (
              <SkillCard
                key={`${sk.scope}:${sk.agent ?? ""}:${sk.name}`}
                skill={sk}
                onEdit={onEditSkill}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function groupSkills(skills: SkillInfo[], globalLabel: string) {
  const groups: { key: string; label: string; items: SkillInfo[] }[] = []
  const globalSkills = skills.filter((s) => s.scope === "global")
  if (globalSkills.length > 0) {
    groups.push({ key: "global", label: globalLabel, items: globalSkills })
  }
  const byAgent = new Map<string, SkillInfo[]>()
  for (const s of skills) {
    if (s.scope !== "agent") continue
    const key = s.agent || ""
    byAgent.set(key, [...(byAgent.get(key) ?? []), s])
  }
  for (const [agentName, items] of byAgent) {
    groups.push({ key: `agent:${agentName}`, label: agentName, items })
  }
  return groups
}

async function handleDelete(
  skill: SkillInfo,
  t: (key: string, vars?: Record<string, string>) => string,
  setError: (msg: string) => void,
  onRefresh: () => void
) {
  if (!window.confirm(t("manage.skillsDeleteConfirm", { name: skill.name })))
    return
  setError("")
  try {
    await deleteSkill(skill.name, skill.scope, skill.agent)
    onRefresh()
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}
