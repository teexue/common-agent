import type { McpServerConfig } from "@/types/agent"

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
  mcpServers: McpServerFormItem[]
}

/** MCP server as edited in the form (args/env as editable strings). */
export interface McpServerFormItem {
  name: string
  type: "stdio" | "sse"
  command: string
  args: string // newline-separated
  env: string // KEY=VALUE per line
  url: string
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
  mcpServers: [],
}

export function emptyMcpServer(): McpServerFormItem {
  return { name: "", type: "stdio", command: "", args: "", env: "", url: "" }
}

/** Converts backend MCP config to the editable form item shape. */
export function mcpConfigToForm(srv: McpServerConfig): McpServerFormItem {
  return {
    name: srv.name ?? "",
    type: srv.type === "sse" ? "sse" : "stdio",
    command: srv.command ?? "",
    args: (srv.args ?? []).join("\n"),
    env: Object.entries(srv.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    url: srv.url ?? "",
  }
}

function parseLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function parseEnv(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of parseLines(s)) {
    const idx = line.indexOf("=")
    if (idx <= 0) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

/** Converts the form item to the backend MCP config shape (drops empty fields). */
export function mcpFormToConfig(srv: McpServerFormItem): McpServerConfig {
  const cfg: McpServerConfig = { name: srv.name.trim(), type: srv.type }
  if (srv.type === "stdio") {
    const cmd = srv.command.trim()
    if (cmd) cfg.command = cmd
    const args = parseLines(srv.args)
    if (args.length > 0) cfg.args = args
  } else {
    const url = srv.url.trim()
    if (url) cfg.url = url
  }
  const env = parseEnv(srv.env)
  if (Object.keys(env).length > 0) cfg.env = env
  return cfg
}

function yamlIndent(s: string, indent: string): string {
  return s
    .split("\n")
    .map((l) => (l.length === 0 ? "" : indent + l))
    .join("\n")
}

function yamlScalar(v: string): string {
  // Quote if empty or contains characters that would confuse YAML scalars.
  if (v === "") return '""'
  if (/["'`#:<>[\]{}(),&*?|=!%\n]/.test(v) || v.startsWith(" ") || v.endsWith(" ")) {
    return JSON.stringify(v)
  }
  return v
}

/** Serializes MCP servers into the `mcp_servers:` YAML block. */
export function mcpServersToYaml(servers: McpServerFormItem[]): string {
  const valid = servers.filter((s) => s.name.trim() !== "")
  if (valid.length === 0) return ""

  const lines: string[] = ["mcp_servers:"]
  for (const srv of valid) {
    const cfg = mcpFormToConfig(srv)
    lines.push(`  - name: ${yamlScalar(cfg.name)}`)
    lines.push(`    type: ${cfg.type}`)
    if (cfg.type === "stdio") {
      if (cfg.command) lines.push(`    command: ${yamlScalar(cfg.command)}`)
      if (cfg.args && cfg.args.length > 0) {
        lines.push(`    args:`)
        for (const a of cfg.args) lines.push(`      - ${yamlScalar(a)}`)
      }
    } else if (cfg.url) {
      lines.push(`    url: ${yamlScalar(cfg.url)}`)
    }
    if (cfg.env && Object.keys(cfg.env).length > 0) {
      lines.push(`    env:`)
      for (const [k, v] of Object.entries(cfg.env)) {
        lines.push(`      ${k}: ${yamlScalar(v)}`)
      }
    }
  }
  return lines.join("\n") + "\n"
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
    lines.push(yamlIndent(form.systemPrompt, "  "))
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

  const mcpBlock = mcpServersToYaml(form.mcpServers)
  if (mcpBlock) {
    lines.push(mcpBlock.slice(0, -1)) // trim trailing newline (join adds one)
  }

  return lines.join("\n") + "\n"
}
