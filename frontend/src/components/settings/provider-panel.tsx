import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Eye, Plus, RefreshCw, Server, Settings, Trash2 } from "lucide-react"
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
import {
  deleteProvider,
  fetchProviderModels,
  fetchProviders,
  fetchVendors,
  upsertProvider,
} from "@/lib/api"
import type { ModelInfo, ProviderInfo, VendorInfo } from "@/types/agent"

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
        <p className="text-sm font-medium text-foreground">{p.display_name || p.name}</p>
        {p.display_name && p.display_name !== p.name && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{p.name}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px] font-mono">{p.api_style}</Badge>
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

type StyleOption = "openai" | "anthropic"

function defaultModelsPath(style: StyleOption): string {
  return style === "anthropic" ? "/v1/models" : "/models"
}

function ProviderForm({ provider, onSaved, onCancel }: { provider?: ProviderInfo; onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const isEdit = !!provider
  const [vendors, setVendors] = useState<VendorInfo[]>([])
  const [vendorName, setVendorName] = useState<string>("")
  const [name, setName] = useState(provider?.name ?? "")
  const [apiStyle, setApiStyle] = useState<StyleOption>((provider?.api_style as StyleOption) ?? "openai")
  const [authStyle, setAuthStyle] = useState<"x-api-key" | "bearer" | "">((provider?.auth_style as "x-api-key" | "bearer") ?? "")
  const [baseURL, setBaseURL] = useState(provider?.base_url ?? "")
  const [baseURLTouched, setBaseURLTouched] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [defaultModel, setDefaultModel] = useState(provider?.default_model ?? "")
  const [modelsPath, setModelsPath] = useState(provider?.models_path ?? "")
  const [vision, setVision] = useState(provider?.vision ?? false)
  const [displayName, setDisplayName] = useState(provider?.display_name ?? "")
  const [modelsPathTouched, setModelsPathTouched] = useState(false)
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVendors()
      .then((list) => setVendors(list ?? []))
      .catch(() => setVendors([]))
  }, [])

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.name === vendorName) ?? null,
    [vendors, vendorName],
  )

  const styleOptions: StyleOption[] = selectedVendor?.supported_styles ?? ["openai", "anthropic"]

  const vendorBaseURL = (v: VendorInfo, style: StyleOption): string =>
    style === "anthropic" ? (v.anthropic_base_url ?? "") : (v.openai_base_url ?? "")
  const vendorAuth = (v: VendorInfo, style: StyleOption): "x-api-key" | "bearer" => {
    if (style === "anthropic") return v.anthropic_auth ?? "x-api-key"
    return "bearer"
  }

  const applyVendor = (v: VendorInfo) => {
    setVendorName(v.name)
    setName((prev) => prev || v.name)
    const style = v.api_style as StyleOption
    setApiStyle(style)
    setBaseURL(vendorBaseURL(v, style))
    setBaseURLTouched(false)
    setAuthStyle(vendorAuth(v, style))
    setDefaultModel(v.default_model)
    setModelsPath(defaultModelsPath(style))
    setModelsPathTouched(false)
    setVision(v.vision)
    setDisplayName(v.display_name)
  }

  const onStyleChange = (style: StyleOption) => {
    setApiStyle(style)
    if (!modelsPathTouched) setModelsPath(defaultModelsPath(style))
    if (selectedVendor) {
      if (!baseURLTouched) setBaseURL(vendorBaseURL(selectedVendor, style))
      setAuthStyle(vendorAuth(selectedVendor, style))
    }
  }

  const canFetch = isEdit || !!apiKey.trim()
  const canSave = !!name.trim() && !!defaultModel.trim() && (isEdit || !!apiKey.trim())

  const handleFetchModels = async () => {
    if (!canFetch) return
    setFetching(true)
    setFetchErr(null)
    try {
      const list = await fetchProviderModels({
        name: name.trim(),
        api_style: apiStyle,
        base_url: baseURL.trim() || undefined,
        models_path: modelsPath.trim() || undefined,
        api_version: undefined,
        auth_style: authStyle || undefined,
        api_key: apiKey.trim() || undefined,
      })
      setModels(list ?? [])
    } catch (e: unknown) {
      setFetchErr(e instanceof Error ? e.message : String(e))
      setModels(null)
    } finally {
      setFetching(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await upsertProvider({
        name: name.trim(),
        api_style: apiStyle,
        base_url: baseURL.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        default_model: defaultModel.trim() || undefined,
        display_name: displayName.trim() || undefined,
        models_path: modelsPath.trim() || undefined,
        auth_style: authStyle || undefined,
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
      {!isEdit && vendors.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerVendor")}</Label>
          <Select
            value={vendorName ? { value: vendorName, label: selectedVendor?.display_name ?? vendorName } : null}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                const found = vendors.find((x) => x.name === (v as { value: string }).value)
                if (found) applyVendor(found)
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue placeholder={t("settings.providerVendorPlaceholder")} /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {vendors.map((v) => (
                <SelectItem key={v.name} value={{ value: v.name, label: v.display_name }}>{v.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isEdit} className="h-9 rounded-lg font-mono text-sm" placeholder="moonshot" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerDisplayName")}</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-9 rounded-lg text-sm"
            placeholder={selectedVendor?.display_name ?? name ?? "My Provider"}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerAPIStyle")}</Label>
          <Select
            value={{ value: apiStyle, label: apiStyle }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) onStyleChange((v as { value: string }).value as StyleOption)
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {styleOptions.map((s) => (
                <SelectItem key={s} value={{ value: s, label: s }}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.providerBaseURL")}</Label>
        <Input
          value={baseURL}
          onChange={(e) => { setBaseURL(e.target.value); setBaseURLTouched(true) }}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder={t("settings.baseURLPlaceholder")}
        />
      </div>

      {apiStyle === "anthropic" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerAuthStyle")}</Label>
          <Select
            value={{ value: authStyle || "x-api-key", label: authStyle || "x-api-key" }}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) setAuthStyle((v as { value: string }).value as "x-api-key" | "bearer")
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={{ value: "x-api-key", label: "x-api-key" }}>x-api-key</SelectItem>
              <SelectItem value={{ value: "bearer", label: "Authorization: Bearer" }}>Authorization: Bearer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
          <div className="flex gap-2">
            <Input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="h-9 rounded-lg font-mono text-sm" placeholder={t("settings.defaultModelPlaceholder")} />
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs"
              onClick={handleFetchModels}
              disabled={fetching || !canFetch}
              title={canFetch ? t("settings.fetchModelsHint") : t("settings.fetchModelsNoKey")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
              {t("settings.fetchModels")}
            </Button>
          </div>
          {fetchErr && <p className="text-[11px] text-destructive">{t("settings.fetchModelsFailed")}: {fetchErr}</p>}
          {apiStyle === "anthropic" && selectedVendor?.supported_styles?.includes("openai") && !fetchErr && (
            <p className="text-[11px] text-muted-foreground">{t("settings.fetchModelsViaOpenAI")}</p>
          )}
          {models && models.length > 0 && (
            <Select
              value={defaultModel ? { value: defaultModel, label: defaultModel } : null}
              onValueChange={(v) => {
                if (v && typeof v === "object" && "value" in v) setDefaultModel((v as { value: string }).value)
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-lg text-sm"><SelectValue placeholder={t("settings.fetchModelsPick")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {models.map((m) => (
                  <SelectItem key={m.id} value={{ value: m.id, label: m.id }}>{m.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.providerModelsPath")}</Label>
          <Input
            value={modelsPath}
            onChange={(e) => { setModelsPath(e.target.value); setModelsPathTouched(true) }}
            className="h-9 rounded-lg font-mono text-sm"
            placeholder={defaultModelsPath(apiStyle)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVision(!vision)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${vision ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          <Eye className="h-3.5 w-3.5" /> {t("settings.providerVision")}
        </button>
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
