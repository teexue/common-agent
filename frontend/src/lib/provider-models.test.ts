import { describe, expect, it } from "vitest"
import {
  chatModelOptions,
  enabledModelsOf,
  modelChoiceKey,
  parseModelChoice,
  withCurrentChatOption,
} from "./provider-models"
import type { ProviderInfo } from "@/types/agent"

function provider(partial: Partial<ProviderInfo>): ProviderInfo {
  return {
    name: "p",
    api_style: "openai",
    display_name: "P",
    base_url: "",
    default_model: "d",
    models_path: "/models",
    vision: false,
    ...partial,
  }
}

describe("enabledModelsOf", () => {
  it("returns the selected subset", () => {
    expect(
      enabledModelsOf(provider({ models: ["a", "b"], default_model: "a" }))
    ).toEqual(["a", "b"])
  })
  it("falls back to default_model", () => {
    expect(enabledModelsOf(provider({ default_model: "only" }))).toEqual([
      "only",
    ])
  })
})

describe("chatModelOptions", () => {
  it("hides models that were not enabled", () => {
    const opts = chatModelOptions([
      provider({
        name: "moonshot",
        display_name: "Moonshot",
        models: ["kimi-k2"],
        default_model: "kimi-k2",
      }),
    ])
    expect(opts).toEqual([
      {
        provider: "moonshot",
        providerLabel: "Moonshot",
        model: "kimi-k2",
      },
    ])
  })
})

describe("withCurrentChatOption", () => {
  it("prepends a legacy model that is not enabled", () => {
    const providers = [
      provider({ name: "p", display_name: "P", models: ["a"] }),
    ]
    const opts = chatModelOptions(providers)
    expect(
      withCurrentChatOption(opts, { provider: "p", model: "legacy" }, providers)
    ).toEqual([
      { provider: "p", providerLabel: "P", model: "legacy" },
      { provider: "p", providerLabel: "P", model: "a" },
    ])
  })
  it("does not duplicate an enabled current value", () => {
    const providers = [
      provider({ name: "p", display_name: "P", models: ["a"] }),
    ]
    const opts = chatModelOptions(providers)
    expect(
      withCurrentChatOption(opts, { provider: "p", model: "a" }, providers)
    ).toEqual(opts)
  })
})

describe("modelChoiceKey", () => {
  it("round-trips provider and model", () => {
    const key = modelChoiceKey("openai", "gpt-4o")
    expect(parseModelChoice(key)).toEqual({
      provider: "openai",
      model: "gpt-4o",
    })
  })
})
