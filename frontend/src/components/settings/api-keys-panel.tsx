import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createAuthKey,
  deleteAuthKey,
  fetchAuthKeys,
  generateClientAPIKey,
  setAccessToken,
  type AuthKeyInfo,
} from "@/lib/api"

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-6">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function CreateKeyForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Generate secret in-browser; never display or persist the raw key.
      const rawKey = generateClientAPIKey()
      const created = await createAuthKey(name, rawKey)
      setAccessToken(created.token)
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.apiKeyName")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="default"
        />
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{t("settings.apiKeyGenerateHint")}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-xl text-xs"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
        >
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  )
}

function KeyCard({
  item,
  onDelete,
}: {
  item: AuthKeyInfo
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 font-mono text-[10px]">
            {item.prefix}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={onDelete}
        title={t("common.delete")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/** API key management: client JWT + multiple hashed server keys. */
export function ApiKeysPanel() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<AuthKeyInfo[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchAuthKeys()
      .then((res) => {
        setKeys(res.keys)
        setEnabled(res.enabled)
      })
      .catch((e: unknown) => {
        setKeys([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (loading) return <EmptyState text={t("common.loading")} />

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <p className="text-[10px] leading-relaxed text-muted-foreground">{t("settings.apiKeyHint")}</p>

      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "default" : "secondary"} className="rounded-md px-1.5 py-0 text-[10px]">
          {enabled ? t("settings.apiKeyEnabled") : t("settings.apiKeyDisabled")}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{t("settings.apiKeyCount", { count: keys.length })}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("settings.apiKeyServerList")}
            </span>
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{keys.length}</Badge>
          </div>
          {!creating && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> {t("settings.apiKeyAdd")}
            </Button>
          )}
        </div>

        {keys.length === 0 && !creating && <EmptyState text={t("settings.apiKeyEmpty")} />}

        {keys.map((k) => (
          <KeyCard
            key={k.id}
            item={k}
            onDelete={async () => {
              await deleteAuthKey(k.id)
              refresh()
            }}
          />
        ))}

        {creating && (
          <CreateKeyForm
            onCreated={() => {
              setCreating(false)
              refresh()
            }}
            onCancel={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  )
}
