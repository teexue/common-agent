import { describe, expect, it } from "vitest"
import { EMPTY_FORM, formDataToYaml } from "./agent-yaml"

describe("formDataToYaml optimize block", () => {
  const base = {
    ...EMPTY_FORM,
    name: "demo",
    provider: "openai",
    model: "gpt-4o",
    tools: ["echo"],
  }

  it("omits the optimize block when both switches are off", () => {
    const yaml = formDataToYaml(base)
    expect(yaml).not.toContain("optimize:")
  })

  it("emits only the enabled switches", () => {
    const yaml = formDataToYaml({ ...base, optimizeSystemPrompt: true })
    expect(yaml).toContain("optimize:\n  system_prompt: true")
    expect(yaml).not.toContain("user_prompt")
  })

  it("emits both switches when enabled", () => {
    const yaml = formDataToYaml({
      ...base,
      optimizeSystemPrompt: true,
      optimizeUserPrompt: true,
    })
    expect(yaml).toContain(
      "optimize:\n  system_prompt: true\n  user_prompt: true"
    )
  })
})
