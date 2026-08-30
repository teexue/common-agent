import type { ProviderInfo } from "@/types/agent"

/** Models the user enabled on a provider. Legacy rows fall back to default. */
export function enabledModelsOf(p: ProviderInfo | undefined): string[] {
  if (!p) return []
  if (p.models && p.models.length > 0) return p.models
  return p.default_model ? [p.default_model] : []
}

export interface ChatModelOption {
  provider: string
  providerLabel: string
  model: string
}

/** Flatten enabled models across providers for the conversation picker. */
export function chatModelOptions(providers: ProviderInfo[]): ChatModelOption[] {
  const out: ChatModelOption[] = []
  for (const p of providers) {
    const label = p.display_name || p.name
    for (const model of enabledModelsOf(p)) {
      out.push({ provider: p.name, providerLabel: label, model })
    }
  }
  return out
}

export function modelChoiceKey(provider: string, model: string): string {
  return `${provider}::${model}`
}

export function parseModelChoice(key: string): {
  provider: string
  model: string
} {
  const i = key.indexOf("::")
  if (i < 0) return { provider: "", model: key }
  return { provider: key.slice(0, i), model: key.slice(i + 2) }
}

/** Prepend the current provider+model when it is missing from the enabled list. */
export function withCurrentChatOption(
  options: ChatModelOption[],
  current: { provider: string; model: string },
  providers: ProviderInfo[]
): ChatModelOption[] {
  if (!current.model) return options
  if (
    options.some(
      (o) => o.provider === current.provider && o.model === current.model
    )
  ) {
    return options
  }
  const p = providers.find((x) => x.name === current.provider)
  return [
    {
      provider: current.provider,
      providerLabel: p?.display_name || p?.name || current.provider,
      model: current.model,
    },
    ...options,
  ]
}
