import { useEffect, useMemo, useState } from "react"
import { fetchVendors } from "@/lib/api"
import type { ProviderInfo, VendorInfo } from "@/types/agent"
import type { AuthStyle, StyleOption } from "./provider-form-utils"

export function useProviderVendors() {
  const [vendors, setVendors] = useState<VendorInfo[]>([])
  const [vendorName, setVendorName] = useState("")
  useEffect(() => {
    fetchVendors()
      .then((list) => setVendors(list ?? []))
      .catch(() => setVendors([]))
  }, [])
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.name === vendorName) ?? null,
    [vendors, vendorName]
  )
  return { vendors, vendorName, setVendorName, selectedVendor }
}

function defaultsFrom(p: ProviderInfo | undefined) {
  if (!p) {
    return {
      name: "",
      apiStyle: "openai" as StyleOption,
      authStyle: "" as AuthStyle,
      baseURL: "",
      defaultModel: "",
      modelsPath: "",
      vision: false,
      displayName: "",
      enabledModels: [] as string[],
    }
  }
  return {
    name: p.name,
    apiStyle: (p.api_style || "openai") as StyleOption,
    authStyle: (p.auth_style || "") as AuthStyle,
    baseURL: p.base_url || "",
    defaultModel: p.default_model || "",
    modelsPath: p.models_path || "",
    vision: !!p.vision,
    displayName: p.display_name || "",
    enabledModels:
      p.models && p.models.length > 0
        ? p.models
        : p.default_model
          ? [p.default_model]
          : [],
  }
}

export function useProviderFieldState(provider?: ProviderInfo) {
  const d = defaultsFrom(provider)
  const isEdit = Boolean(provider)
  const [name, setName] = useState(d.name)
  const [apiStyle, setApiStyle] = useState<StyleOption>(d.apiStyle)
  const [authStyle, setAuthStyle] = useState<AuthStyle>(d.authStyle)
  const [baseURL, setBaseURL] = useState(d.baseURL)
  const [baseURLTouched, setBaseURLTouched] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [defaultModel, setDefaultModel] = useState(d.defaultModel)
  const [modelsPath, setModelsPath] = useState(d.modelsPath)
  const [modelsPathTouched, setModelsPathTouched] = useState(false)
  const [vision, setVision] = useState(d.vision)
  const [displayName, setDisplayName] = useState(d.displayName)
  const [enabledModels, setEnabledModels] = useState<string[]>(d.enabledModels)
  return {
    isEdit,
    name,
    setName,
    apiStyle,
    setApiStyle,
    authStyle,
    setAuthStyle,
    baseURL,
    setBaseURL,
    baseURLTouched,
    setBaseURLTouched,
    apiKey,
    setApiKey,
    defaultModel,
    setDefaultModel,
    modelsPath,
    setModelsPath,
    modelsPathTouched,
    setModelsPathTouched,
    vision,
    setVision,
    displayName,
    setDisplayName,
    enabledModels,
    setEnabledModels,
    provider,
  }
}

export type ProviderFields = ReturnType<typeof useProviderFieldState>
export type ProviderVendors = ReturnType<typeof useProviderVendors>
