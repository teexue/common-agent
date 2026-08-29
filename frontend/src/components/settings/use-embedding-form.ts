import { useEffect, useMemo, useState } from "react"
import {
  fetchEmbeddingConfig,
  fetchEmbeddingVendors,
  saveEmbeddingConfig,
} from "@/lib/api"
import type { EmbeddingConfig, EmbeddingVendorInfo } from "@/types/agent"
import { errMessage } from "./select-value"

function fetchEmbeddingSetup(): Promise<
  [EmbeddingVendorInfo[], EmbeddingConfig]
> {
  return Promise.all([
    fetchEmbeddingVendors().catch(() => [] as EmbeddingVendorInfo[]),
    fetchEmbeddingConfig().catch(
      () => ({ backend: "openai", model: "" }) as EmbeddingConfig
    ),
  ])
}

export function useEmbeddingState() {
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
    fetchEmbeddingSetup()
      .then(([vs, cfg]) => {
        setVendors(vs)
        applyLoadedConfig(cfg, {
          setVendorName,
          setBackend,
          setBaseURL,
          setApiKeyEnv,
          setModel,
          setDimensions,
          setHasAPIKey,
        })
      })
      .finally(() => setLoading(false))
  }, [])
  return {
    vendors,
    vendorName,
    setVendorName,
    backend,
    setBackend,
    baseURL,
    setBaseURL,
    apiKeyEnv,
    setApiKeyEnv,
    model,
    setModel,
    dimensions,
    setDimensions,
    apiKey,
    setApiKey,
    hasAPIKey,
    setHasAPIKey,
    loading,
    saving,
    setSaving,
    error,
    setError,
    ok,
    setOk,
  }
}

export type EmbeddingFormState = ReturnType<typeof useEmbeddingState>

function applyLoadedConfig(
  cfg: EmbeddingConfig,
  set: Pick<
    EmbeddingFormState,
    | "setVendorName"
    | "setBackend"
    | "setBaseURL"
    | "setApiKeyEnv"
    | "setModel"
    | "setDimensions"
    | "setHasAPIKey"
  >
) {
  set.setVendorName(cfg.vendor || "")
  set.setBackend(cfg.backend || "openai")
  set.setBaseURL(cfg.base_url || "")
  set.setApiKeyEnv(cfg.api_key_env || "")
  set.setModel(cfg.model || "")
  set.setDimensions(cfg.dimensions && cfg.dimensions > 0 ? cfg.dimensions : "")
  set.setHasAPIKey(!!cfg.has_api_key)
}

export function applyEmbeddingVendor(
  v: EmbeddingVendorInfo,
  set: Pick<
    EmbeddingFormState,
    | "setVendorName"
    | "setBackend"
    | "setBaseURL"
    | "setApiKeyEnv"
    | "setModel"
    | "setDimensions"
  >
) {
  set.setVendorName(v.name)
  set.setBackend(v.backend)
  set.setBaseURL(v.base_url)
  set.setApiKeyEnv(v.api_key_env || "")
  set.setModel(v.default_model)
  set.setDimensions(
    v.default_dimensions && v.default_dimensions > 0 ? v.default_dimensions : ""
  )
}

export function useEmbeddingDerived(form: EmbeddingFormState) {
  const selectedVendor = useMemo(
    () => form.vendors.find((v) => v.name === form.vendorName) ?? null,
    [form.vendors, form.vendorName]
  )
  const list = selectedVendor?.models ?? []
  const modelOptions =
    form.model && !list.includes(form.model) ? [form.model, ...list] : list
  const dimensionOptions = selectedVendor?.dimensions ?? []
  const needsKey = form.backend !== "ollama"
  const showDimensions =
    form.backend !== "ollama" && dimensionOptions.length > 0
  const canSave =
    !!form.model.trim() &&
    !!form.baseURL.trim() &&
    (!needsKey || !!form.apiKeyEnv.trim()) &&
    (!needsKey || form.hasAPIKey || !!form.apiKey.trim())
  return {
    selectedVendor,
    modelOptions,
    dimensionOptions,
    needsKey,
    showDimensions,
    canSave,
  }
}

export async function saveEmbeddingForm(
  form: EmbeddingFormState,
  needsKey: boolean
) {
  form.setSaving(true)
  form.setError(null)
  form.setOk(false)
  try {
    const saved = await saveEmbeddingConfig({
      vendor: form.vendorName || undefined,
      backend: form.backend,
      base_url: form.baseURL.trim(),
      api_key_env: needsKey ? form.apiKeyEnv.trim() : undefined,
      model: form.model.trim(),
      dimensions:
        typeof form.dimensions === "number" ? form.dimensions : undefined,
      api_key: form.apiKey.trim() || undefined,
    })
    applyLoadedConfig(saved, form)
    form.setApiKey("")
    form.setOk(true)
  } catch (e) {
    form.setError(errMessage(e))
  } finally {
    form.setSaving(false)
  }
}
