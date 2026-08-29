import { upsertGlobalMCP } from "@/lib/api"

export interface GlobalFormState {
  name: string
  type: "stdio" | "sse"
  command: string
  args: string
  env: string
  url: string
}

export function emptyForm(): GlobalFormState {
  return { name: "", type: "stdio", command: "", args: "", env: "", url: "" }
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

export function serverToForm(s: {
  name: string
  type: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}): GlobalFormState {
  return {
    name: s.name,
    type: s.type === "sse" ? "sse" : "stdio",
    command: s.command ?? "",
    args: (s.args ?? []).join("\n"),
    env: Object.entries(s.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    url: s.url ?? "",
  }
}

export function toMcpPayload(
  form: GlobalFormState
): Parameters<typeof upsertGlobalMCP>[0] {
  const payload: Parameters<typeof upsertGlobalMCP>[0] = {
    name: form.name.trim(),
    type: form.type,
  }
  if (form.type === "stdio") {
    const cmd = form.command.trim()
    if (cmd) payload.command = cmd
    const args = parseLines(form.args)
    if (args.length > 0) payload.args = args
  } else {
    const url = form.url.trim()
    if (url) payload.url = url
  }
  const env = parseEnv(form.env)
  if (Object.keys(env).length > 0) payload.env = env
  return payload
}
