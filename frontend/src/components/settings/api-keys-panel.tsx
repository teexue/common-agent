import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { ListRow } from "@/components/shared/list-row"
import {
  CreateKeyDialog,
  CreatedKeyDialog,
  DeleteKeyDialog,
} from "@/components/settings/api-key-dialogs"
import { parseScopes, scopeLabel } from "@/components/settings/api-key-scopes"
import {
  fetchAuthKeys,
  updateAuthKey,
  type AuthKeyInfo,
  type CreatedAuthKey,
} from "@/lib/api"
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

function KeyRow({
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

/** API key management: scoped server keys with expiry and enable toggles. */
export function ApiKeysPanel() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<AuthKeyInfo[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<CreatedAuthKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthKeyInfo | null>(null)

  // All setState runs in promise callbacks so the mount effect stays clean.
  const refresh = useCallback(() => {
    fetchAuthKeys()
      .then((res) => {
        setKeys(res.keys)
        setEnabled(res.enabled)
        setError(null)
      })
      .catch((e: unknown) => {
        setKeys([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleToggle = async (item: AuthKeyInfo) => {
    setError(null)
    try {
      await updateAuthKey(item.id, { enabled: !item.enabled })
      refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (loading) return <EmptyState title={t("common.loading")} />

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.apiKeyHint")}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={enabled ? "default" : "secondary"}
            className="rounded-md px-1.5 py-0 text-[10px]"
          >
            {enabled
              ? t("settings.apiKeyEnabled")
              : t("settings.apiKeyDisabled")}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {t("settings.apiKeyCount", { count: keys.length })}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> {t("settings.apiKeyAdd")}
        </Button>
      </div>

      {keys.length === 0 && <EmptyState title={t("settings.apiKeyEmpty")} />}

      {keys.map((k) => (
        <KeyRow
          key={k.id}
          item={k}
          onToggle={() => void handleToggle(k)}
          onDelete={() => setDeleteTarget(k)}
        />
      ))}

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(key) => {
          setCreated(key)
          refresh()
        }}
      />
      <CreatedKeyDialog created={created} onClose={() => setCreated(null)} />
      <DeleteKeyDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDone={refresh}
      />
    </div>
  )
}
