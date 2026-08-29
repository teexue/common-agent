import type { ProviderInfo, VendorInfo } from "@/types/agent"
import {
  defaultModelsPath,
  vendorAuth,
  vendorBaseURL,
  vendorRequiresKey,
  type StyleOption,
} from "./provider-form-utils"
import {
  useProviderFieldState,
  useProviderVendors,
  type ProviderFields,
} from "./use-provider-fields"
import { useProviderDetail } from "./use-provider-detail"
import { useProviderModels, useProviderSave } from "./use-provider-save"

function applyVendorPreset(
  v: VendorInfo,
  f: ProviderFields,
  clearDetail: () => void
) {
  clearDetail()
  f.setName((prev) => prev || v.name)
  const style = v.api_style as StyleOption
  f.setApiStyle(style)
  f.setBaseURL(vendorBaseURL(v, style))
  f.setBaseURLTouched(false)
  f.setAuthStyle(vendorAuth(v, style))
  f.setDefaultModel(v.default_model)
  f.setModelsPath(defaultModelsPath(style))
  f.setModelsPathTouched(false)
  f.setVision(v.vision)
  f.setDisplayName(v.display_name)
}

function applyStyleChange(
  style: StyleOption,
  f: ProviderFields,
  selectedVendor: VendorInfo | null,
  clearDetail: () => void
) {
  clearDetail()
  f.setApiStyle(style)
  if (!f.modelsPathTouched) f.setModelsPath(defaultModelsPath(style))
  if (!selectedVendor) return
  if (!f.baseURLTouched) f.setBaseURL(vendorBaseURL(selectedVendor, style))
  f.setAuthStyle(vendorAuth(selectedVendor, style))
}

export function useProviderForm(
  provider: ProviderInfo | undefined,
  onSaved: () => void
) {
  const vendors = useProviderVendors()
  const fields = useProviderFieldState(provider)
  const detail = useProviderDetail({
    apiStyle: fields.apiStyle,
    defaultModel: fields.defaultModel,
    name: fields.name,
    baseURL: fields.baseURL,
    modelsPath: fields.modelsPath,
    authStyle: fields.authStyle,
    apiKey: fields.apiKey,
  })
  const requiresKey = vendorRequiresKey(vendors.selectedVendor)
  const canFetch = fields.isEdit || !requiresKey || !!fields.apiKey.trim()
  const canSave =
    !!fields.name.trim() &&
    !!fields.defaultModel.trim() &&
    (fields.isEdit || !requiresKey || !!fields.apiKey.trim())
  const models = useProviderModels({
    canFetch,
    name: fields.name,
    apiStyle: fields.apiStyle,
    baseURL: fields.baseURL,
    modelsPath: fields.modelsPath,
    authStyle: fields.authStyle,
    apiKey: fields.apiKey,
  })
  const save = useProviderSave({
    fields,
    vendors,
    contextWindow: detail.detail?.context_window,
    onSaved,
  })
  return {
    vendors,
    fields,
    detail,
    models,
    requiresKey,
    canFetch,
    canSave,
    save,
    applyVendor: (v: VendorInfo) => {
      vendors.setVendorName(v.name)
      applyVendorPreset(v, fields, detail.clearDetail)
    },
    onStyleChange: (style: StyleOption) =>
      applyStyleChange(
        style,
        fields,
        vendors.selectedVendor,
        detail.clearDetail
      ),
  }
}

export type ProviderFormModel = ReturnType<typeof useProviderForm>
