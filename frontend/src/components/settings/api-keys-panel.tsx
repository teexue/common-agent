import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { CreateKeyDialog } from "./create-key-dialog"
import { CreatedKeyDialog } from "./created-key-dialog"
import { DeleteKeyDialog } from "./delete-key-dialog"
import { KeyRow } from "./key-row"
import {
  fetchAuthKeys,
  updateAuthKey,
  type AuthKeyInfo,
  type CreatedAuthKey,
} from "@/lib/api"
import { FormError } from "./form-error"
import { errMessage } from "./select-value"

function useApiKeysPanel() {
  const [keys, setKeys] = useState<AuthKeyInfo[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<CreatedAuthKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthKeyInfo | null>(null)
  const refresh = useCallback(() => {
    fetchAuthKeys()
      .then((res) => {
        setKeys(res.keys)
        setEnabled(res.enabled)
        setError(null)
      })
      .catch((e: unknown) => {
        setKeys([])
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return {
    keys,
    enabled,
    loading,
    error,
    setError,
    createOpen,
    setCreateOpen,
    created,
    setCreated,
    deleteTarget,
    setDeleteTarget,
    refresh,
  }
}

function KeysToolbar({
  enabled,
  count,
  onAdd,
}: {
  enabled: boolean
  count: number
  onAdd: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge
          variant={enabled ? "default" : "secondary"}
          className="rounded-md px-1.5 py-0 text-[10px]"
        >
          {enabled ? t("settings.apiKeyEnabled") : t("settings.apiKeyDisabled")}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {t("settings.apiKeyCount", { count })}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5" /> {t("settings.apiKeyAdd")}
      </Button>
    </div>
  )
}

/** API key management: scoped server keys with expiry and enable toggles. */
export function ApiKeysPanel() {
  const { t } = useTranslation()
  const p = useApiKeysPanel()
  const handleToggle = async (item: AuthKeyInfo) => {
    p.setError(null)
    try {
      await updateAuthKey(item.id, { enabled: !item.enabled })
      p.refresh()
    } catch (e: unknown) {
      p.setError(errMessage(e))
    }
  }
  if (p.loading) return <EmptyState title={t("common.loading")} />
  return (
    <div className="space-y-3">
      <FormError error={p.error} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.apiKeyHint")}
      </p>
      <KeysToolbar
        enabled={p.enabled}
        count={p.keys.length}
        onAdd={() => p.setCreateOpen(true)}
      />
      {p.keys.length === 0 && <EmptyState title={t("settings.apiKeyEmpty")} />}
      {p.keys.map((k) => (
        <KeyRow
          key={k.id}
          item={k}
          onToggle={() => void handleToggle(k)}
          onDelete={() => p.setDeleteTarget(k)}
        />
      ))}
      <CreateKeyDialog
        open={p.createOpen}
        onOpenChange={p.setCreateOpen}
        onCreated={(key) => {
          p.setCreated(key)
          p.refresh()
        }}
      />
      <CreatedKeyDialog
        created={p.created}
        onClose={() => p.setCreated(null)}
      />
      <DeleteKeyDialog
        target={p.deleteTarget}
        onClose={() => p.setDeleteTarget(null)}
        onDone={p.refresh}
      />
    </div>
  )
}
