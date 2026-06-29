import type { ConversationEntry } from "@/types/agent"

// ─── Message conversion (frontend → backend) ─────────────────────

export interface BackendMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  reasoning_content?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
  name?: string
}

export function toBackendMessages(
  entries: ConversationEntry[]
): BackendMessage[] {
  const msgs: BackendMessage[] = []

  for (const entry of entries) {
    if (entry.role === "user") {
      msgs.push({ role: "user", content: entry.content })
    }

    if (entry.role === "assistant") {
      if (entry.toolCalls && entry.toolCalls.length > 0) {
        msgs.push({
          role: "assistant",
          content: entry.content || "",
          reasoning_content: entry.reasoningContent || undefined,
          tool_calls: entry.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.input ?? {},
          })),
        })
        for (const tc of entry.toolCalls) {
          if (tc.status === "completed" && tc.output !== undefined) {
            msgs.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.name,
              content:
                typeof tc.output === "string"
                  ? tc.output
                  : JSON.stringify(tc.output),
            })
          }
        }
      } else if (entry.content) {
        msgs.push({
          role: "assistant",
          content: entry.content,
          reasoning_content: entry.reasoningContent || undefined,
        })
      }
    }
  }

  return msgs
}

// ─── Backend message → ConversationEntry conversion ───────────────

export interface BackendMsg {
  role: string
  content?: string
  reasoning_content?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
  name?: string
}

export function fromBackendMessages(msgs: BackendMsg[]): ConversationEntry[] {
  const entries: ConversationEntry[] = []
  for (const msg of msgs) {
    if (msg.role === "system") continue

    if (msg.role === "user") {
      entries.push({
        id: `loaded-user-${entries.length}`,
        role: "user",
        content: msg.content ?? "",
        timestamp: Date.now(),
      })
    }

    if (msg.role === "assistant") {
      entries.push({
        id: `loaded-assistant-${entries.length}`,
        role: "assistant",
        content: msg.content ?? "",
        reasoningContent: msg.reasoning_content,
        toolCalls: (msg.tool_calls ?? []).map((tc) => ({
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
          status: "completed" as const,
        })),
        timestamp: Date.now(),
      })
    }
  }
  return entries
}

// ─── SSE Parser ───────────────────────────────────────────────────

import type { AgentEvent } from "@/types/agent"

export function parseSSELine(line: string): AgentEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as AgentEvent
  } catch {
    return null
  }
}
