import { useEffect, useState } from "react"
import { fetchProviderModels, upsertProvider } from "@/lib/api"
import type { ModelInfo } from "@/types/agent"
import { errMessage } from "./select-value"
import type { ProviderFields, ProviderVendors } from "./use-provider-fields"
import type { StyleOption } from "./provider-form-utils"

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function listFetchArgs(
  opts: {
    name: string
    apiStyle: StyleOption
    baseURL: string
    modelsPath: string
    authStyle: string
  },
  apiKey: string
) {
  return {
    name: opts.name.trim(),
    api_style: opts.apiStyle,
    base_url: opts.baseURL.trim() || undefined,
    models_path: opts.modelsPath.trim() || undefined,
    auth_style: opts.authStyle || undefined,
    api_key: apiKey.trim() || undefined,
  }
}

function modelsFetchKey(
  opts: {
    name: string
    apiStyle: StyleOption
    baseURL: string
    modelsPath: string
    authStyle: string
  },
  apiKey: string
): string {
  return JSON.stringify(listFetchArgs(opts, apiKey))
}

export function useProviderModels(opts: {
  canFetch: boolean
  name: string
  apiStyle: StyleOption
  baseURL: string
  modelsPath: string
  authStyle: string
  apiKey: string
}) {
  const { canFetch, name, apiStyle, baseURL, modelsPath, authStyle, apiKey } =
    opts
  const fp = modelsFetchKey(
    { name, apiStyle, baseURL, modelsPath, authStyle },
    apiKey
  )
  const debounced = useDebounced(fp, 400)
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [loadedFp, setLoadedFp] = useState<string | null>(null)
  useEffect(() => {
    if (!canFetch || !debounced) return
    let cancelled = false
    fetchProviderModels(
      JSON.parse(debounced) as ReturnType<typeof listFetchArgs>
    )
      .then((list) => {
        if (cancelled) return
        setModels(list ?? [])
        setFetchErr(null)
        setLoadedFp(debounced)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFetchErr(errMessage(e))
        setLoadedFp(debounced)
      })
    return () => {
      cancelled = true
    }
  }, [canFetch, debounced])
  return {
    models,
    fetching: canFetch && (debounced === "" || loadedFp !== debounced),
    fetchErr,
  }
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
        models: f.enabledModels,
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
