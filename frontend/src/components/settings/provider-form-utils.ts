import type { VendorInfo } from "@/types/agent"

export type StyleOption = "openai" | "anthropic" | "ollama"

export function defaultModelsPath(style: StyleOption): string {
  switch (style) {
    case "anthropic":
      return "/v1/models"
    case "ollama":
      return "/api/tags"
    default:
      return "/models"
  }
}

export function vendorBaseURL(v: VendorInfo, style: StyleOption): string {
  if (style === "anthropic") return v.anthropic_base_url ?? ""
  return v.openai_base_url ?? ""
}

export function vendorAuth(
  v: VendorInfo,
  style: StyleOption
): "x-api-key" | "bearer" {
  if (style === "anthropic") return v.anthropic_auth ?? "x-api-key"
  return "bearer"
}

/** vendorRequiresKey reports whether the vendor preset needs an API key.
 *  Local Ollama has an empty api_key_env (no auth); everything else does. */
export function vendorRequiresKey(v: VendorInfo | null | undefined): boolean {
  if (!v) return true
  return !!v.api_key_env
}
