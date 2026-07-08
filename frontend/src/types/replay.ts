// ─── Audit Tree Nodes ─────────────────────────────────────────────

export interface TextNode {
  type: "text"
  eventIndex: number
  content: string
  kind: "text" | "reasoning"
}

export interface ToolCallNode {
  type: "tool_call"
  startIndex: number
  resultIndex?: number
  toolCallId: string
  name: string
  input: unknown
  output?: unknown
  status: "running" | "completed" | "error"
  durationMs?: number
}

export interface SystemNode {
  type: "system"
  eventIndex: number
  kind: "compaction" | "sub_agent_start" | "sub_agent_end" | "error" | "done" | "approval_required"
  content?: string
  agent?: string
}

export type AuditNode = TextNode | ToolCallNode | SystemNode

// ─── Turn (L1 audit node) ─────────────────────────────────────────

export interface TurnNode {
  turn: number
  startTimestamp: string
  endTimestamp?: string
  nodes: AuditNode[]
}

// ─── Replay conversation entry ────────────────────────────────────

export interface ReplayEntry {
  id: string
  turn: number
  timestamp: number
  textDeltas: { index: number; content: string }[]
  reasoningDeltas: { index: number; content: string }[]
  toolCalls: { startIndex: number; resultIndex?: number; toolCallId: string; name: string; input: unknown }[]
  systemEvents: { index: number; kind: string; content?: string }[]
}

// ─── Playback ─────────────────────────────────────────────────────

export type PlaybackSpeed = 0.5 | 1 | 2 | 10 | 20

export interface PlaybackState {
  currentIndex: number
  isPlaying: boolean
  speed: PlaybackSpeed
  totalCount: number
}

// ─── Parsed replay data ───────────────────────────────────────────

export interface ParsedReplay {
  turnNodes: TurnNode[]
  replayEntries: ReplayEntry[]
  flatNodes: IndexedNode[]
}

export interface IndexedNode {
  node: AuditNode
  turn: number
}
