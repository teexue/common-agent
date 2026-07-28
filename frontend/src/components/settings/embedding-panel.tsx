import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Save } from "lucide-react"
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
import { fetchEmbeddingConfig, fetchEmbeddingVendors, saveEmbeddingConfig } from "@/lib/api"
import type { EmbeddingConfig, EmbeddingVendorInfo } from "@/types/agent"

/** Settings panel for embedding backend used by RAG (independent of chat providers). */
export function EmbeddingPanel() {
  const { t } = useTranslation()
  const [vendors, setVendors] = useState<EmbeddingVendorInfo[]>([])
  const [vendorName, setVendorName] = useState("")
  const [backend, setBackend] = useState("openai")
  const [baseURL, setBaseURL] = useState("")
  const [apiKeyEnv, setApiKeyEnv] = useState("")
  const [model, setModel] = useState("")
  const [dimensions, setDimensions] = useState<number | "">("")
  const [apiKey, setApiKey] = useState("")
  const [hasAPIKey, setHasAPIKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchEmbeddingVendors().catch(() => [] as EmbeddingVendorInfo[]),
      fetchEmbeddingConfig().catch(() => ({ backend: "openai", model: "" }) as EmbeddingConfig),
    ])
      .then(([vs, cfg]) => {
        setVendors(vs)
        setVendorName(cfg.vendor || "")
        setBackend(cfg.backend || "openai")
        setBaseURL(cfg.base_url || "")
        setApiKeyEnv(cfg.api_key_env || "")
        setModel(cfg.model || "")
        setDimensions(cfg.dimensions && cfg.dimensions > 0 ? cfg.dimensions : "")
        setHasAPIKey(!!cfg.has_api_key)
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.name === vendorName) ?? null,
    [vendors, vendorName],
  )

  const modelOptions = useMemo(() => {
    const list = selectedVendor?.models ?? []
    if (model && !list.includes(model)) return [model, ...list]
    return list
  }, [selectedVendor, model])

  const dimensionOptions = selectedVendor?.dimensions ?? []
  const showDimensions = backend !== "ollama" && dimensionOptions.length > 0

  // Match ProviderForm: selecting a vendor always fills defaults.
  const applyVendor = (v: EmbeddingVendorInfo) => {
    setVendorName(v.name)
    setBackend(v.backend)
    setBaseURL(v.base_url)
    setApiKeyEnv(v.api_key_env || "")
    setModel(v.default_model)
    setDimensions(v.default_dimensions && v.default_dimensions > 0 ? v.default_dimensions : "")
  }

  const needsKey = backend !== "ollama"
  const canSave =
    !!model.trim() &&
    !!baseURL.trim() &&
    (!needsKey || !!apiKeyEnv.trim()) &&
    (!needsKey || hasAPIKey || !!apiKey.trim())

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      const saved = await saveEmbeddingConfig({
        vendor: vendorName || undefined,
        backend,
        base_url: baseURL.trim(),
        api_key_env: needsKey ? apiKeyEnv.trim() : undefined,
        model: model.trim(),
        dimensions: typeof dimensions === "number" ? dimensions : undefined,
        api_key: apiKey.trim() || undefined,
      })
      setVendorName(saved.vendor || "")
      setBackend(saved.backend || "openai")
      setBaseURL(saved.base_url || "")
      setApiKeyEnv(saved.api_key_env || "")
      setModel(saved.model || "")
      setDimensions(saved.dimensions && saved.dimensions > 0 ? saved.dimensions : "")
      setHasAPIKey(!!saved.has_api_key)
      setApiKey("")
      setOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">{t("settings.mcpLoading")}</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("settings.embeddingHint")}</p>

      {vendors.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.embeddingVendor")}</Label>
          <Select
            value={vendorName ? { value: vendorName, label: selectedVendor?.display_name ?? vendorName } : null}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                const found = vendors.find((x) => x.name === (v as { value: string }).value)
                if (found) applyVendor(found)
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl text-xs">
              <SelectValue placeholder={t("settings.embeddingVendorPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {vendors.map((v) => (
                <SelectItem key={v.name} value={{ value: v.name, label: v.display_name }}>
                  {v.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.embeddingBaseUrl")}</Label>
        <Input
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
          className="h-9 rounded-xl font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">{t("settings.embeddingBaseUrlHint")}</p>
      </div>

      {needsKey && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("settings.embeddingApiKeyEnv")}</Label>
            <Input
              value={apiKeyEnv}
              onChange={(e) => setApiKeyEnv(e.target.value)}
              placeholder="DASHSCOPE_API_KEY"
              className="h-9 rounded-xl font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.embeddingApiKey")}
              {hasAPIKey ? ` (${t("settings.embeddingApiKeySet")})` : ""}
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasAPIKey ? t("settings.embeddingApiKeyKeep") : "sk-..."}
              className="h-9 rounded-xl font-mono text-xs"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.embeddingModel")}</Label>
        {modelOptions.length > 0 ? (
          <Select
            value={model ? { value: model, label: model } : null}
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                setModel((v as { value: string }).value)
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl font-mono text-xs">
              <SelectValue placeholder={t("settings.embeddingModelPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {modelOptions.map((m) => (
                <SelectItem key={m} value={{ value: m, label: m }}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={backend === "ollama" ? "nomic-embed-text" : "text-embedding-v4"}
            className="h-9 rounded-xl font-mono text-xs"
          />
        )}
      </div>

      {showDimensions && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("settings.embeddingDimensions")}</Label>
          <Select
            value={
              typeof dimensions === "number"
                ? { value: String(dimensions), label: String(dimensions) }
                : null
            }
            onValueChange={(v) => {
              if (v && typeof v === "object" && "value" in v) {
                const n = Number((v as { value: string }).value)
                setDimensions(Number.isFinite(n) && n > 0 ? n : "")
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl font-mono text-xs">
              <SelectValue placeholder={t("settings.embeddingDimensionsPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {dimensionOptions.map((d) => (
                <SelectItem key={d} value={{ value: String(d), label: String(d) }}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">{t("settings.embeddingDimensionsHint")}</p>
        </div>
      )}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      {ok && <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{t("settings.embeddingSaved")}</p>}

      <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs" disabled={saving || !canSave} onClick={handleSave}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {t("common.save")}
      </Button>
    </div>
  )
}
