import { describe, expect, it } from "vitest"
import { EMPTY_FORM, formDataToYaml } from "./agent-yaml"

describe("formDataToYaml max_tokens", () => {
  const base = {
    ...EMPTY_FORM,
    name: "demo",
    provider: "openai",
    model: "gpt-4o",
    tools: ["echo"],
  }

  it("defaults to auto (0) and omits max_tokens", () => {
    expect(EMPTY_FORM.maxTokens).toBe(0)
    expect(formDataToYaml(base)).not.toContain("max_tokens:")
  })

  it("emits max_tokens when set", () => {
    expect(formDataToYaml({ ...base, maxTokens: 16000 })).toContain(
      "max_tokens: 16000"
    )
  })
})

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

describe("formDataToYaml permissions block", () => {
  const base = {
    ...EMPTY_FORM,
    name: "demo",
    provider: "openai",
    model: "gpt-4o",
    tools: ["echo", "read_file"],
  }

  it("omits the block when every selected tool is auto-approved", () => {
    const yaml = formDataToYaml({
      ...base,
      autoApprove: ["echo", "read_file"],
      alwaysDeny: [],
    })
    expect(yaml).not.toContain("permissions:")
  })

  it("emits an explicit empty-list block when all tools require confirmation", () => {
    const yaml = formDataToYaml({
      ...base,
      autoApprove: [],
      alwaysDeny: [],
    })
    expect(yaml).toContain("permissions:")
    expect(yaml).toContain("  auto_approve: []")
    expect(yaml).toContain("  always_deny: []")
  })

  it("emits the block when some tools require confirmation", () => {
    const yaml = formDataToYaml({
      ...base,
      autoApprove: ["echo"],
      alwaysDeny: [],
    })
    expect(yaml).toContain("permissions:")
    expect(yaml).toContain("  auto_approve:\n    - echo")
  })

  it("emits always_deny when a tool is denied", () => {
    const yaml = formDataToYaml({
      ...base,
      autoApprove: ["echo"],
      alwaysDeny: ["read_file"],
    })
    expect(yaml).toContain("  always_deny:\n    - read_file")
  })
})
