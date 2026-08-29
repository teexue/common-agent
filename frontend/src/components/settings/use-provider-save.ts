import { useState } from "react"
import { fetchProviderModels, upsertProvider } from "@/lib/api"
import type { ModelInfo } from "@/types/agent"
import { errMessage } from "./select-value"
import type { ProviderFields, ProviderVendors } from "./use-provider-fields"
import type { StyleOption } from "./provider-form-utils"

export function useProviderModels(opts: {
  canFetch: boolean
  name: string
  apiStyle: StyleOption
  baseURL: string
  modelsPath: string
  authStyle: string
  apiKey: string
}) {
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const handleFetchModels = async () => {
    if (!opts.canFetch) return
    setFetching(true)
    setFetchErr(null)
    try {
      const list = await fetchProviderModels({
        name: opts.name.trim(),
        api_style: opts.apiStyle,
        base_url: opts.baseURL.trim() || undefined,
        models_path: opts.modelsPath.trim() || undefined,
        api_version: undefined,
        auth_style: opts.authStyle || undefined,
        api_key: opts.apiKey.trim() || undefined,
      })
      setModels(list ?? [])
    } catch (e: unknown) {
      setFetchErr(errMessage(e))
      setModels(null)
    } finally {
      setFetching(false)
    }
  }
  return { models, fetching, fetchErr, handleFetchModels }
}

export function useProviderSave(opts: {
  fields: ProviderFields
  vendors: ProviderVendors
  contextWindow?: number
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSave = async () => {
    const f = opts.fields
    setSaving(true)
    setError(null)
    try {
      await upsertProvider({
        name: f.name.trim(),
        api_style: f.apiStyle,
        base_url: f.baseURL.trim() || undefined,
        api_key: f.apiKey.trim() || undefined,
        api_key_env:
          opts.vendors.selectedVendor?.api_key_env ||
          f.provider?.api_key_env ||
          undefined,
        default_model: f.defaultModel.trim() || undefined,
        display_name: f.displayName.trim() || undefined,
        models_path: f.modelsPath.trim() || undefined,
        auth_style: f.authStyle || undefined,
        vision: f.vision,
        context_window: opts.contextWindow || undefined,
      })
      opts.onSaved()
    } catch (e: unknown) {
      setError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, handleSave }
}
