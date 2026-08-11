import type { VendorInfo } from "@/types/agent"

export type StyleOption = "openai" | "anthropic"

export function defaultModelsPath(style: StyleOption): string {
  return style === "anthropic" ? "/v1/models" : "/models"
}

export function vendorBaseURL(v: VendorInfo, style: StyleOption): string {
  return style === "anthropic"
    ? (v.anthropic_base_url ?? "")
    : (v.openai_base_url ?? "")
}

export function vendorAuth(
  v: VendorInfo,
  style: StyleOption
): "x-api-key" | "bearer" {
  if (style === "anthropic") return v.anthropic_auth ?? "x-api-key"
  return "bearer"
}
