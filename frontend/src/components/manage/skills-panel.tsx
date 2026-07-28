import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, Pencil, Plus, Puzzle, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SkillFormDialog } from "@/components/manage/skills-dialogs"
import { SkillInstallDialog } from "@/components/manage/skills-install-dialog"
import { deleteSkill } from "@/lib/api"
import type { AgentInfo, SkillInfo } from "@/types/agent"

interface SkillsPanelProps {
  skills: SkillInfo[]
  loading: boolean
  agents: AgentInfo[]
  onRefresh: () => void
}

function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillInfo
  onEdit: (skill: SkillInfo) => void
  onDelete: (skill: SkillInfo) => void
}) {
  const { t } = useTranslation()
  const scopeBadge =
    skill.scope === "global"
      ? { label: t("manage.skillsScopeGlobal"), cls: "bg-primary/10 text-primary" }
      : { label: skill.agent ?? "", cls: "bg-warning/10 text-warning" }
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Puzzle className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{skill.name}</p>
          {skill.version && (
            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-xs font-mono">
              v{skill.version}
            </Badge>
          )}
          <span className={`rounded-md px-1.5 py-0.5 text-xs ${scopeBadge.cls}`}>
            {scopeBadge.label}
          </span>
        </div>
        {skill.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {skill.description}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {t("manage.toolsCount", { count: (skill.tools ?? []).length })}
          {skill.format ? ` · ${skill.format}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(skill)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(skill)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

/** Skills management panel: scope-grouped list with create/edit/delete/install. */
export function SkillsPanel({ skills, loading, agents, onRefresh }: SkillsPanelProps) {
  const { t } = useTranslation()
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editing, setEditing] = useState<SkillInfo | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [error, setError] = useState("")

  const groups = groupSkills(skills, t("manage.skillsGlobalGroup"))

  const handleEdit = (skill: SkillInfo) => {
    setEditing(skill)
    setFormMode("edit")
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditing(null)
    setFormMode("create")
    setFormOpen(true)
  }

  const handleDelete = async (skill: SkillInfo) => {
    if (!window.confirm(t("manage.skillsDeleteConfirm", { name: skill.name }))) return
    setError("")
    try {
      await deleteSkill(skill.name, skill.scope, skill.agent)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{t("manage.skillsHint")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={handleCreate}
          >
            <Plus className="h-3.5 w-3.5" /> {t("manage.skillsCreate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => setInstallOpen(true)}
          >
            <Download className="h-3.5 w-3.5" /> {t("manage.skillsInstall")}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading ? (
        <EmptyState text={t("manage.loading")} />
      ) : skills.length === 0 ? (
        <EmptyState text={t("manage.skillsEmpty")} />
      ) : (
        groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
            <div className="space-y-2">
              {g.items.map((sk) => (
                <SkillCard
                  key={`${sk.scope}:${sk.agent ?? ""}:${sk.name}`}
                  skill={sk}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))
      )}
      <SkillFormDialog
        open={formOpen}
        mode={formMode}
        skill={editing}
        agents={agents}
        onOpenChange={setFormOpen}
        onSaved={onRefresh}
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
