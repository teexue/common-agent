/** Form data shape for the Agent editor. */
export interface AgentFormData {
  id: string
  name: string
  provider: string
  model: string
  systemPrompt: string
  tools: string[]
  maxTurns: number
  maxTokens: number
  execMode: "parallel" | "serial"
  maxParallel: number
  autoApprove: string[]
  alwaysDeny: string[]
}

export const EMPTY_FORM: AgentFormData = {
  id: "",
  name: "",
  provider: "",
  model: "",
  systemPrompt: "You are a helpful assistant.",
  tools: [],
  maxTurns: 10,
  maxTokens: 4096,
  execMode: "parallel",
  maxParallel: 4,
  autoApprove: [],
  alwaysDeny: [],
}

/** Converts AgentFormData to a YAML string for the backend. */
export function formDataToYaml(form: AgentFormData): string {
  const lines: string[] = []
  if (form.id) {
    lines.push(`id: ${form.id}`)
  }
  lines.push(
    `name: ${form.name}`,
    `version: 1`,
    `provider: ${form.provider}`,
    `model: ${form.model}`,
  )

  if (form.systemPrompt) {
    lines.push(`system_prompt: |`)
    for (const line of form.systemPrompt.split("\n")) {
      lines.push(`  ${line}`)
    }
  }

  lines.push(`tools:`)
  for (const t of form.tools) {
    lines.push(`  - ${t}`)
  }

  lines.push(`max_turns: ${form.maxTurns}`)
  if (form.maxTokens) {
    lines.push(`max_tokens: ${form.maxTokens}`)
  }

  lines.push(`tool_execution:`)
  lines.push(`  mode: ${form.execMode}`)
  lines.push(`  max_parallel: ${form.maxParallel}`)

  if (form.autoApprove.length > 0 || form.alwaysDeny.length > 0) {
    lines.push(`permissions:`)
    if (form.autoApprove.length > 0) {
      lines.push(`  auto_approve:`)
      for (const t of form.autoApprove) {
        lines.push(`    - ${t}`)
      }
    }
    if (form.alwaysDeny.length > 0) {
      lines.push(`  always_deny:`)
      for (const t of form.alwaysDeny) {
        lines.push(`    - ${t}`)
      }
    }
  }

  return lines.join("\n") + "\n"
}
