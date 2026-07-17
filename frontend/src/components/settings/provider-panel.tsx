import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Eye, Plus, Server, Settings, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deleteProvider, fetchProviders, upsertProvider } from "@/lib/api"
import type { ProviderInfo } from "@/types/agent"

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-6">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function ProviderCard({ provider: p, onEdit, onDelete }: { provider: ProviderInfo; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20 hover:bg-muted/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Server className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{p.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{p.type}</Badge>
          {p.default_model && <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{p.default_model}</Badge>}
          {p.vision && (
            <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px] gap-0.5">
              <Eye className="h-2.5 w-2.5" /> {t("settings.providerVision")}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ProviderForm({ provider, onSaved, onCancel }: { provider?: ProviderInfo; onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const isEdit = !!provider
  const [name, setName] = useState(provider?.name ?? "")
  const [type, setType] = useState(provider?.type ?? "openai")
  const [baseURL, setBaseURL] = useState(provider?.base_url ?? "")
  const [apiKey, setApiKey] = useState("")
  const [defaultModel, setDefaultModel] = useState(provider?.default_model ?? "")
  const [vision, setVision] = useState(provider?.vision ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = !!name.trim() && !!defaultModel.trim() && (isEdit || !!apiKey.trim())

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await upsertProvider({
        name: name.trim(),
        type,
        base_url: baseURL.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        default_model: defaultModel.trim() || undefined,
        vision,
      })
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isEdit} className="h-9 rounded-lg font-mono text-sm" placeholder="moonshot" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerType")}</Label>
          <Select
            value={{ value: type, label: type }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) setType((v as { value: string }).value)
            }}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={{ value: "openai", label: "openai" }}>openai</SelectItem>
              <SelectItem value={{ value: "anthropic", label: "anthropic" }}>anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.providerBaseURL")}</Label>
        <Input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} className="h-9 rounded-lg font-mono text-sm" placeholder={t("settings.baseURLPlaceholder")} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.providerApiKey")}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={isEdit ? t("settings.keepExisting") : t("settings.apiKeyPlaceholder")}
          autoComplete="off"
        />
        {isEdit && <p className="text-[11px] text-muted-foreground">{t("settings.apiKeyHint")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerDefaultModel")}</Label>
          <Input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="h-9 rounded-lg font-mono text-sm" placeholder={t("settings.defaultModelPlaceholder")} />
        </div>
        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => setVision(!vision)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${vision ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            <Eye className="h-3.5 w-3.5" /> {t("settings.providerVision")}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-8 rounded-lg px-4 text-xs" onClick={onCancel}>{t("settings.cancel")}</Button>
        <Button size="sm" className="h-8 gap-1.5 rounded-lg px-4 text-xs" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? t("settings.loading") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/** Provider list / create / edit panel for Settings. */
export function ProviderPanel() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchProviders()
      .then((list) => setProviders(list ?? []))
      .catch((e: unknown) => {
        setProviders([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  if (loading) return <EmptyState text={t("settings.loading")} />

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      {providers.length === 0 && editing === null && (
        <EmptyState text={t("settings.providersEmpty")} />
      )}
      {providers.map((p) => (
        editing === p.name
          ? <ProviderForm key={p.name} provider={p} onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} />
          : (
            <ProviderCard
              key={p.name}
              provider={p}
              onEdit={() => setEditing(p.name)}
              onDelete={async () => { await deleteProvider(p.name); refresh() }}
            />
          )
      ))}
      {editing === "" && <ProviderForm onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} />}
      {editing === null && (
        <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl text-xs" onClick={() => setEditing("")}>
          <Plus className="h-3.5 w-3.5" /> {t("settings.addProvider")}
        </Button>
      )}
    </div>
  )
}
