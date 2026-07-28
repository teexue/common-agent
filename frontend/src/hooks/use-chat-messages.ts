import type { ConversationEntry } from "@/types/agent"

// ─── Backend message → ConversationEntry conversion ───────────────
// Runs are sent with only the latest user message; history flows the other
// way (backend session → UI) when loading a session.

export interface BackendMsg {
  role: string
  content?: string
  reasoning_content?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
  name?: string
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
      entries.push({
        id: `loaded-user-${entries.length}`,
        role: "user",
        content: msg.content ?? "",
        timestamp: Date.now(),
      })
    }

    if (msg.role === "assistant") {
      const toolCalls = (msg.tool_calls ?? []).map((tc) => {
        const output = toolOutputs.get(tc.id)
        return {
          id: tc.id,
          toolCallId: tc.id,
          name: tc.name,
          input: tc.arguments,
          output: output ? tryParseJSON(output) : undefined,
          status: "completed" as const,
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

function tryParseJSON(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
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
