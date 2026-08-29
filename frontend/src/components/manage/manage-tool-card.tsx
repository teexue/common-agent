import { useTranslation } from "react-i18next"
import { Wrench } from "lucide-react"
import { ListRow } from "@/components/shared/list-row"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"
import type { ToolInfo } from "@/types/agent"

export function ToolCard({
  tool,
  onSelect,
}: {
  tool: ToolInfo
  onSelect?: (tool: ToolInfo) => void
}) {
  const { t } = useTranslation()
  return (
    <ListRow
      onClick={() => onSelect?.(tool)}
      className="flex w-full items-start gap-3 text-left"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {toolDisplayName(tool.name, t)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {tool.name}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {toolDisplayDescription(tool.name, tool.description, t)}
        </p>
      </div>
    </ListRow>
  )
}
