import { useEffect, useMemo, useState } from "react"
import { fetchProviderModels, fetchVendors, upsertProvider } from "@/lib/api"
import type { ModelInfo, ProviderInfo, VendorInfo } from "@/types/agent"
import {
  ApiKeyField,
  AuthStyleField,
  BaseURLField,
  FormActions,
  IdentityFields,
  ModelFields,
  VendorSelect,
  VisionToggle,
} from "./provider-form-fields"
import {
  defaultModelsPath,
  vendorAuth,
  vendorBaseURL,
  vendorRequiresKey,
  type StyleOption,
} from "./provider-form-utils"

export function ProviderForm({
  provider,
  onSaved,
  onCancel,
}: {
  provider?: ProviderInfo
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!provider
  const [vendors, setVendors] = useState<VendorInfo[]>([])
  const [vendorName, setVendorName] = useState<string>("")
  const [name, setName] = useState(provider?.name ?? "")
  const [apiStyle, setApiStyle] = useState<StyleOption>(
    (provider?.api_style as StyleOption) ?? "openai"
  )
  const [authStyle, setAuthStyle] = useState<"x-api-key" | "bearer" | "">(
    (provider?.auth_style as "x-api-key" | "bearer") ?? ""
  )
  const [baseURL, setBaseURL] = useState(provider?.base_url ?? "")
  const [baseURLTouched, setBaseURLTouched] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [defaultModel, setDefaultModel] = useState(
    provider?.default_model ?? ""
  )
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
    [vendors, vendorName]
  )

  const styleOptions: StyleOption[] = selectedVendor?.supported_styles ?? [
    "openai",
    "anthropic",
  ]

  // Local Ollama (empty api_key_env on the vendor preset) needs no API key.
  const requiresKey = vendorRequiresKey(selectedVendor)

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

  const canFetch = isEdit || !requiresKey || !!apiKey.trim()
  const canSave =
    !!name.trim() &&
    !!defaultModel.trim() &&
    (isEdit || !requiresKey || !!apiKey.trim())

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
        api_key_env: selectedVendor?.api_key_env || undefined,
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
        <VendorSelect
          vendors={vendors}
          vendorName={vendorName}
          selectedVendor={selectedVendor}
          onApply={applyVendor}
        />
      )}

      <IdentityFields
        isEdit={isEdit}
        name={name}
        onNameChange={setName}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        selectedVendor={selectedVendor}
        apiStyle={apiStyle}
        styleOptions={styleOptions}
        onStyleChange={onStyleChange}
      />

      <BaseURLField
        baseURL={baseURL}
        onBaseURLChange={(v) => {
          setBaseURL(v)
          setBaseURLTouched(true)
        }}
      />

      {apiStyle === "anthropic" && (
        <AuthStyleField
          authStyle={authStyle}
          onAuthStyleChange={setAuthStyle}
        />
      )}

      <ApiKeyField
        isEdit={isEdit}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        optional={!requiresKey}
      />

      <ModelFields
        defaultModel={defaultModel}
        onDefaultModelChange={setDefaultModel}
        modelsPath={modelsPath}
        onModelsPathChange={(v) => {
          setModelsPath(v)
          setModelsPathTouched(true)
        }}
        apiStyle={apiStyle}
        models={models}
        fetching={fetching}
        canFetch={canFetch}
        fetchErr={fetchErr}
        showOpenAIHint={
          apiStyle === "anthropic" &&
          !!selectedVendor?.supported_styles?.includes("openai") &&
          !fetchErr
        }
        apiKeyOptional={!requiresKey}
        onFetchModels={handleFetchModels}
      />

      <VisionToggle vision={vision} onToggle={() => setVision(!vision)} />

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <FormActions
        saving={saving}
        canSave={canSave}
        onCancel={onCancel}
        onSave={handleSave}
      />
    </div>
  )
}
