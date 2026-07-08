import type { ReplayEvent } from "@/types/agent"
import type {
  AuditNode,
  IndexedNode,
  ParsedReplay,
  ReplayEntry,
  ToolCallNode,
  TurnNode,
} from "@/types/replay"

export function parseReplayEvents(events: ReplayEvent[]): ParsedReplay {
  const turnMap = new Map<number, { startTime: string; endTime?: string; nodes: AuditNode[] }>()
  const toolStartMap = new Map<string, ToolCallNode>()
  const flatNodes: IndexedNode[] = []

  for (let i = 0; i < events.length; i++) {
    const record = events[i]
    const { event, turn, ts } = record

    if (!turnMap.has(turn)) {
      turnMap.set(turn, { startTime: ts, nodes: [] })
    }
    const turnData = turnMap.get(turn)!
    turnData.endTime = ts

    const node = buildAuditNode(event, i, toolStartMap)
    if (node) {
      turnData.nodes.push(node)
      flatNodes.push({ node, turn })
    }
  }

  const turnNodes: TurnNode[] = []
  for (const [turn, data] of turnMap) {
    turnNodes.push({
      turn,
      startTimestamp: data.startTime,
      endTimestamp: data.endTime,
      nodes: data.nodes,
    })
  }
  turnNodes.sort((a, b) => a.turn - b.turn)

  const replayEntries = buildReplayEntries(events)

  return { turnNodes, replayEntries, flatNodes }
}

function buildReplayEntries(events: ReplayEvent[]): ReplayEntry[] {
  const entries: ReplayEntry[] = []
  let current: ReplayEntry | null = null
  const toolMap = new Map<string, { startIndex: number; resultIndex?: number; toolCallId: string; name: string; input: unknown }>()

  for (let i = 0; i < events.length; i++) {
    const { event, turn, ts } = events[i]

    switch (event.type) {
      case "text_delta":
      case "reasoning_delta": {
        if (!current || current.turn !== turn) {
          current = createEntry(turn, ts)
          entries.push(current)
        }
        const delta = { index: i, content: event.content ?? "" }
        if (event.type === "text_delta") {
          current.textDeltas.push(delta)
        } else {
          current.reasoningDeltas.push(delta)
        }
        break
      }

      case "tool_start": {
        const toolEntry = createEntry(turn, ts)
        toolEntry.toolCalls.push({
          startIndex: i,
          toolCallId: event.tool_call_id ?? "",
          name: event.tool ?? "unknown",
          input: event.input,
        })
        entries.push(toolEntry)
        current = toolEntry
        if (event.tool_call_id) toolMap.set(event.tool_call_id, toolEntry.toolCalls[0])
        break
      }

      case "tool_result": {
        const existing = event.tool_call_id ? toolMap.get(event.tool_call_id) : undefined
        if (existing) {
          existing.resultIndex = i
        }
        break
      }

      case "compaction": {
        if (!current || current.turn !== turn) {
          current = createEntry(turn, ts)
          entries.push(current)
        }
        current.systemEvents.push({ index: i, kind: "compaction", content: event.content })
        break
      }

      case "error": {
        if (!current || current.turn !== turn) {
          current = createEntry(turn, ts)
          entries.push(current)
        }
        current.systemEvents.push({ index: i, kind: "error", content: event.message ?? event.code })
        break
      }

      case "done":
        break

      default:
        break
    }
  }

  return entries
}

function createEntry(turn: number, ts: string): ReplayEntry {
  return {
    id: `replay-${turn}-${ts}`,
    turn,
    timestamp: new Date(ts).getTime(),
    textDeltas: [],
    reasoningDeltas: [],
    toolCalls: [],
    systemEvents: [],
  }
}

function buildAuditNode(
  event: ReplayEvent["event"],
  index: number,
  toolStartMap: Map<string, ToolCallNode>,
): AuditNode | null {
  switch (event.type) {
    case "text_delta":
      return { type: "text", eventIndex: index, content: event.content ?? "", kind: "text" }
    case "reasoning_delta":
      return { type: "text", eventIndex: index, content: event.content ?? "", kind: "reasoning" }

    case "tool_start": {
      const node: ToolCallNode = {
        type: "tool_call",
        startIndex: index,
        toolCallId: event.tool_call_id ?? "",
        name: event.tool ?? "unknown",
        input: event.input,
        status: "running",
      }
      if (node.toolCallId) toolStartMap.set(node.toolCallId, node)
      return node
    }

    case "tool_result": {
      const existing = event.tool_call_id ? toolStartMap.get(event.tool_call_id) : undefined
      if (existing) {
        existing.resultIndex = index
        existing.output = event.output
        existing.status = event.code ? "error" : "completed"
        return null
      }
      return {
        type: "tool_call",
        startIndex: index,
        resultIndex: index,
        toolCallId: event.tool_call_id ?? "",
        name: event.tool ?? "unknown",
        input: undefined,
        output: event.output,
        status: event.code ? "error" : "completed",
      } as ToolCallNode
    }

    case "tool_approval_required":
      return { type: "system", eventIndex: index, kind: "approval_required", content: event.tool ?? "" }

    case "compaction":
      return { type: "system", eventIndex: index, kind: "compaction", content: event.content }

    case "sub_agent_start":
      return { type: "system", eventIndex: index, kind: "sub_agent_start", content: event.content, agent: event.tool }

    case "sub_agent_end":
      return { type: "system", eventIndex: index, kind: "sub_agent_end", content: event.content, agent: event.tool }

    case "error":
      return { type: "system", eventIndex: index, kind: "error", content: event.message ?? event.code }

    case "done":
      return { type: "system", eventIndex: index, kind: "done", content: event.status }

    default:
      return null
  }
}

/** Build visible ConversationEntry[] from ReplayEntry[] up to currentIndex */
export function buildVisibleEntries(entries: ReplayEntry[], currentIndex: number) {
  const result: Array<{
    id: string
    role: "assistant"
    content: string
    reasoningContent?: string
    toolCalls?: Array<{
      id: string
      toolCallId: string
      name: string
      input: unknown
      output?: unknown
      status: "running" | "completed"
      startTime: number
      endTime?: number
    }>
    timestamp: number
    isStreaming: boolean
  }> = []

  for (const entry of entries) {
    if (entry.textDeltas.length === 0 && entry.reasoningDeltas.length === 0 && entry.toolCalls.length === 0 && entry.systemEvents.length === 0) continue

    const visibleTextDeltas = entry.textDeltas.filter((d) => d.index <= currentIndex)
    const visibleReasoningDeltas = entry.reasoningDeltas.filter((d) => d.index <= currentIndex)
    const visibleToolCalls = entry.toolCalls.filter((tc) => tc.startIndex <= currentIndex)

    if (visibleTextDeltas.length === 0 && visibleReasoningDeltas.length === 0 && visibleToolCalls.length === 0 && entry.systemEvents.filter((s) => s.index <= currentIndex).length === 0) {
      continue
    }

    const content = visibleTextDeltas.map((d) => d.content).join("")
    const reasoningContent = visibleReasoningDeltas.map((d) => d.content).join("")
    const lastDeltaIndex = visibleTextDeltas.length > 0 ? visibleTextDeltas[visibleTextDeltas.length - 1].index : -1
    const isStreaming = lastDeltaIndex === currentIndex && currentIndex < (entry.textDeltas[entry.textDeltas.length - 1]?.index ?? Infinity)

    const toolCalls = visibleToolCalls.map((tc) => ({
      id: tc.toolCallId || `tc-${tc.startIndex}`,
      toolCallId: tc.toolCallId,
      name: tc.name,
      input: tc.input,
      output: undefined as unknown,
      status: (tc.resultIndex != null && tc.resultIndex <= currentIndex ? "completed" : "running") as "running" | "completed",
      startTime: tc.startIndex,
      endTime: tc.resultIndex,
    }))

    result.push({
      id: entry.id,
      role: "assistant",
      content,
      reasoningContent: reasoningContent || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: entry.timestamp,
      isStreaming,
    })
  }

  return result
}
