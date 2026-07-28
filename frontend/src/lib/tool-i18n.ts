import type { TFunction } from "i18next"
import i18n from "@/i18n"

/** Returns a localized display label for a tool id; falls back to the raw name. */
export function toolDisplayName(name: string, t: TFunction = i18n.t.bind(i18n)): string {
  const key = `tools.names.${name}`
  const label = t(key, { defaultValue: "" })
  return label || name
}

/** Returns a localized description for UI; falls back to the API/English description. */
export function toolDisplayDescription(
  name: string,
  fallback: string,
  t: TFunction = i18n.t.bind(i18n),
): string {
  const key = `tools.descriptions.${name}`
  const label = t(key, { defaultValue: "" })
  return label || fallback
}
