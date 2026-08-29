import { useTranslation } from "react-i18next"
import { Eye, Server, Settings, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/shared/list-row"
import type { ProviderInfo } from "@/types/agent"

function ProviderBadges({ provider: p }: { provider: ProviderInfo }) {
  const { t } = useTranslation()
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge
        variant="secondary"
        className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
      >
        {p.api_style}
      </Badge>
      {p.default_model && (
        <Badge
          variant="outline"
          className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
        >
          {p.default_model}
        </Badge>
      )}
      {p.vision && (
        <Badge
          variant="outline"
          className="gap-0.5 rounded-md px-1.5 py-0.5 text-[10px]"
        >
          <Eye className="h-2.5 w-2.5" /> {t("settings.providerVision")}
        </Badge>
      )}
    </div>
  )
}

export function ProviderCard({
  provider: p,
  onEdit,
  onDelete,
}: {
  provider: ProviderInfo
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <ListRow className="group flex items-center gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Server className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {p.display_name || p.name}
        </p>
        {p.display_name && p.display_name !== p.name && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {p.name}
          </p>
        )}
        <ProviderBadges provider={p} />
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ListRow>
  )
}
