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

  it("omits the optimize block when the switch is off", () => {
    const yaml = formDataToYaml(base)
    expect(yaml).not.toContain("optimize:")
  })

  it("emits user_prompt when the switch is on", () => {
    const yaml = formDataToYaml({ ...base, optimizeUserPrompt: true })
    expect(yaml).toContain("optimize:\n  user_prompt: true")
  })
})
