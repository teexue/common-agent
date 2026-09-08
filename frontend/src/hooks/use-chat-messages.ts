import type { AgentEvent, ConversationEntry } from "@/types/agent"
import { parseUserContent, type ContentPart } from "@/lib/attachments"

export interface BackendMsg {
  role: string
  content?: string
  reasoning_content?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
  name?: string
  content_parts?: ContentPart[]
}

export function fromBackendMessages(msgs: BackendMsg[]): ConversationEntry[] {
  // 先收集所有 tool 角色消息，按 tool_call_id 索引
  const toolOutputs = new Map<string, string>()
  for (const msg of msgs) {
    if (msg.role === "tool" && msg.tool_call_id && msg.content) {
      toolOutputs.set(msg.tool_call_id, msg.content)
    }
  }

  const entries: ConversationEntry[] = []
  for (const msg of msgs) {
    if (msg.role === "system") continue

    if (msg.role === "user") {
      if (isToolImageUserMessage(msg)) {
        attachToolImagePreview(entries, msg)
        continue
      }
      entries.push(userEntryFromBackend(msg, entries.length))
    }

    if (msg.role === "assistant") {
      const toolCalls = (msg.tool_calls ?? []).map((tc) => {
        const output = toolOutputs.get(tc.id)
        const parsed = output ? tryParseJSON(output) : undefined
        return {
          id: tc.id,
          toolCallId: tc.id,
          name: tc.name,
          input: tc.arguments,
          output: parsed,
          status: "completed" as const,
          sessionId: sessionIdFromOutput(parsed),
        }
      })
      entries.push({
        id: `loaded-assistant-${entries.length}`,
        role: "assistant",
        content: msg.content ?? "",
        reasoningContent: msg.reasoning_content,
        toolCalls,
        timestamp: Date.now(),
      })
    }
  }
  return entries
}

/** Must match provider.ToolImageUserPrefix — synthetic vision follow-ups. */
const TOOL_IMAGE_USER_PREFIX = "[image from tool "

function isToolImageUserMessage(msg: BackendMsg): boolean {
  return (msg.content ?? "").startsWith(TOOL_IMAGE_USER_PREFIX)
}

function toolNameFromImageMarker(content: string): string | null {
  if (!content.startsWith(TOOL_IMAGE_USER_PREFIX)) return null
  const rest = content.slice(TOOL_IMAGE_USER_PREFIX.length)
  if (!rest.endsWith("]")) return null
  const name = rest.slice(0, -1).trim()
  return name || null
}

function attachToolImagePreview(
  entries: ConversationEntry[],
  msg: BackendMsg
): void {
  const toolName = toolNameFromImageMarker(msg.content ?? "")
  const urls = (msg.content_parts ?? [])
    .filter((p) => p.type === "image_url" && p.image_url?.url)
    .map((p) => p.image_url!.url)
  if (!toolName || urls.length === 0) return
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry.role !== "assistant" || !entry.toolCalls?.length) continue
    for (let j = entry.toolCalls.length - 1; j >= 0; j--) {
      const tc = entry.toolCalls[j]
      if (tc.name !== toolName) continue
      const base =
        tc.output && typeof tc.output === "object" && !Array.isArray(tc.output)
          ? (tc.output as Record<string, unknown>)
          : {}
      entry.toolCalls[j] = {
        ...tc,
        output: { ...base, data_url: urls[0], data_urls: urls },
      }
      return
    }
  }
}

function userEntryFromBackend(
  msg: BackendMsg,
  index: number
): ConversationEntry {
  const parsed = parseUserContent(msg.content ?? "", msg.content_parts)
  return {
    id: `loaded-user-${index}`,
    role: "user",
    content: parsed.text,
    timestamp: Date.now(),
    ...(parsed.attachments.length > 0
      ? { attachments: parsed.attachments }
      : {}),
  }
}

function tryParseJSON(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

function sessionIdFromOutput(output: unknown): string | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) return
  const sid = (output as Record<string, unknown>).session_id
  return typeof sid === "string" && sid ? sid : undefined
}

export function parseSSELine(line: string): AgentEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as AgentEvent
  } catch {
    return null
  }
}
