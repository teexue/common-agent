import { useTranslation } from "react-i18next"
import { Pencil, Puzzle, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SkillInfo } from "@/types/agent"

export function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillInfo
  onEdit?: (skill: SkillInfo) => void
  onDelete: (skill: SkillInfo) => void
}) {
  const { t } = useTranslation()
  const scopeBadge =
    skill.scope === "global"
      ? {
          label: t("manage.skillsScopeGlobal"),
          cls: "bg-primary/10 text-primary",
        }
      : { label: skill.agent ?? "", cls: "bg-warning/10 text-warning" }
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Puzzle className="h-4 w-4 text-muted-foreground" />
      </div>
      <SkillCardBody skill={skill} scopeBadge={scopeBadge} />
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(skill)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
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

function SkillCardBody({
  skill,
  scopeBadge,
}: {
  skill: SkillInfo
  scopeBadge: { label: string; cls: string }
}) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{skill.name}</p>
        {skill.version && (
          <Badge
            variant="outline"
            className="rounded-md px-1.5 py-0 font-mono text-xs"
          >
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
  )
}
