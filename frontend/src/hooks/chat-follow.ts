import { apiHeaders } from "@/lib/api"
import type { AgentEvent } from "@/types/agent"
import type { ChatAction } from "./use-chat-state"
import {
  fromBackendMessages,
  parseSSELine,
  type BackendMsg,
} from "./use-chat-messages"
import { dispatchSSEEvent } from "./chat-sse"

export interface ResumeMeta {
  agent: string
  workdir: string | null
  model: string
  provider: string
}

interface SnapshotFrame {
  type: "snapshot"
  session_id: string
  agent: string
  messages: BackendMsg[]
  metadata?: Record<string, string>
}

interface StreamBuf {
  decoder: TextDecoder
  buffer: string
}

function isSnapshot(value: unknown): value is SnapshotFrame {
  if (!value || typeof value !== "object") return false
  return (value as { type?: string }).type === "snapshot"
}

function metaFromSnapshot(snap: SnapshotFrame): ResumeMeta {
  return {
    agent: snap.agent,
    workdir: snap.metadata?.workdir || null,
    model: snap.metadata?.model || "",
    provider: snap.metadata?.provider || "",
  }
}

/** Follows a live run. Resolves after the snapshot; the rest streams in the background. */
export async function followLiveRun(
  sessionId: string,
  signal: AbortSignal,
  dispatch: (action: ChatAction) => void
): Promise<ResumeMeta | null> {
  const res = await fetch(
    `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
    { headers: apiHeaders(), signal }
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.message ?? `HTTP ${res.status}`)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")
  const buf: StreamBuf = { decoder: new TextDecoder(), buffer: "" }
  const started = await readSnapshot(reader, buf, dispatch)
  if (!started) return null
  void drainFollow(reader, buf, started.entryId, dispatch).catch(
    (err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return
      console.error("Failed to follow live run:", err)
    }
  )
  return started.meta
}

async function readSnapshot(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buf: StreamBuf,
  dispatch: (action: ChatAction) => void
): Promise<{ meta: ResumeMeta; entryId: string } | null> {
  while (true) {
    const { done, value } = await reader.read()
    if (done) return null
    const lines = pushBytes(buf, value)
    for (let i = 0; i < lines.length; i++) {
      const parsed: unknown = parseLine(lines[i])
      if (!isSnapshot(parsed)) continue
      buf.buffer = [...lines.slice(i + 1), buf.buffer].join("\n")
      return {
        meta: metaFromSnapshot(parsed),
        entryId: applySnapshot(parsed, dispatch),
      }
    }
  }
}

async function drainFollow(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buf: StreamBuf,
  entryId: string,
  dispatch: (action: ChatAction) => void
): Promise<void> {
  if (applyFollowLines(pendingLines(buf), entryId, dispatch)) return
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (applyFollowLines(pushBytes(buf, value), entryId, dispatch)) return
  }
  dispatch({ type: "STREAM_DONE", entryId, status: "completed", turns: 0 })
}

function pendingLines(buf: StreamBuf): string[] {
  const lines = buf.buffer.split("\n")
  buf.buffer = lines.pop() ?? ""
  return lines
}

function applyFollowLines(
  lines: string[],
  entryId: string,
  dispatch: (action: ChatAction) => void
): boolean {
  for (const line of lines) {
    const parsed: unknown = parseLine(line)
    if (!parsed || isSnapshot(parsed)) continue
    if (dispatchSSEEvent(parsed as AgentEvent, entryId, dispatch)) return true
  }
  return false
}

function pushBytes(buf: StreamBuf, value: Uint8Array): string[] {
  buf.buffer += buf.decoder.decode(value, { stream: true })
  const lines = buf.buffer.split("\n")
  buf.buffer = lines.pop() ?? ""
  return lines
}

function parseLine(line: string): unknown {
  const trimmed = line.trim()
  if (!trimmed) return null
  return parseSSELine(trimmed)
}

function applySnapshot(
  snap: SnapshotFrame,
  dispatch: (action: ChatAction) => void
): string {
  const entryId = `assistant-${Date.now()}`
  dispatch({
    type: "LOAD_LIVE",
    sessionId: snap.session_id,
    messages: fromBackendMessages(snap.messages ?? []),
    metadata: snap.metadata,
  })
  dispatch({ type: "START_ASSISTANT", entryId })
  return entryId
}
