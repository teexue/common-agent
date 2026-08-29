import { useTranslation } from "react-i18next"
import { KeyRound, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/shared/list-row"
import { parseScopes, scopeLabel } from "./api-key-scopes"
import type { AuthKeyInfo } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"

function ScopeBadges({ scopes }: { scopes: string }) {
  const { t } = useTranslation()
  const list = parseScopes(scopes)
  if (list.length === 0) return null
  return (
    <>
      {list.map((s) => (
        <Badge
          key={s}
          variant="outline"
          className="rounded-md px-1.5 py-0 text-[10px]"
        >
          {scopeLabel(t, s)}
        </Badge>
      ))}
    </>
  )
}

function KeySubtitle({ item }: { item: AuthKeyInfo }) {
  const { t } = useTranslation()
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground">
      {item.expires_at &&
        t("settings.apiKeyExpiresAt", {
          time: new Date(item.expires_at).toLocaleDateString(),
        })}
      {item.expires_at && item.last_used_at && " · "}
      {item.last_used_at &&
        t("settings.apiKeyLastUsed", {
          time: formatRelativeTime(item.last_used_at),
        })}
      {!item.expires_at &&
        !item.last_used_at &&
        formatRelativeTime(item.created_at)}
    </p>
  )
}

export function KeyRow({
  item,
  onToggle,
  onDelete,
}: {
  item: AuthKeyInfo
  onToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <ListRow className="group flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <Badge
            variant="secondary"
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
          >
            {item.prefix}
          </Badge>
          <ScopeBadges scopes={item.scopes} />
        </div>
        <KeySubtitle item={item} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${item.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          title={
            item.enabled
              ? t("settings.apiKeyEnabled")
              : t("settings.apiKeyDisabled")
          }
        >
          <span
            className={`h-3 w-3 rounded-full bg-background transition-transform ${item.enabled ? "translate-x-3" : ""}`}
          />
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          onClick={onDelete}
          title={t("common.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ListRow>
  )
}
