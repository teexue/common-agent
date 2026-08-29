import { useTranslation } from "react-i18next"
import { Copy, Edit3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AgentDetail } from "@/types/agent"

export function AgentHeader({
  detail,
  onEdit,
  onCopy,
  onDelete,
}: {
  detail: AgentDetail
  onEdit?: (n: string) => void
  onCopy?: (n: string) => void
  onDelete?: (n: string) => void
}) {
  const key = detail.id || detail.name
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="font-heading text-base text-foreground">
          {detail.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          {detail.id && (
            <Badge
              variant="outline"
              className="rounded-md px-1.5 py-0 font-mono text-[10px] text-muted-foreground"
            >
              {detail.id}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="rounded-md px-1.5 py-0 font-mono text-[10px]"
          >
            {detail.provider}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-md px-1.5 py-0 font-mono text-[10px]"
          >
            {detail.model}
          </Badge>
        </div>
      </div>
      <AgentHeaderActions
        agentKey={key}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    </div>
  )
}

function AgentHeaderActions({
  agentKey,
  onEdit,
  onCopy,
  onDelete,
}: {
  agentKey: string
  onEdit?: (n: string) => void
  onCopy?: (n: string) => void
  onDelete?: (n: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1.5">
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-lg text-xs"
          onClick={() => onEdit(agentKey)}
        >
          <Edit3 className="h-3 w-3" /> {t("common.edit")}
        </Button>
      )}
      {onCopy && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-lg text-xs"
          onClick={() => onCopy(agentKey)}
        >
          <Copy className="h-3 w-3" /> {t("common.copy")}
        </Button>
      )}
      {onDelete && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(agentKey)}
        >
          {t("common.delete")}
        </Button>
      )}
    </div>
  )
}
