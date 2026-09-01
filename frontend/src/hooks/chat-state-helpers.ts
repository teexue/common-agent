import type {
  ConversationEntry,
  FileAttachment,
  ToolCallEntry,
} from "@/types/agent"

export function matchesToolCall(
  tc: ToolCallEntry,
  toolName: string,
  toolCallId?: string
): boolean {
  if (toolCallId && tc.toolCallId) {
    return tc.toolCallId === toolCallId
  }
  return tc.name === toolName
}

/** Update a message entry by id with a transform function. */
export function updateMessage(
  messages: ConversationEntry[],
  entryId: string,
  fn: (m: ConversationEntry) => ConversationEntry
): ConversationEntry[] {
  return messages.map((m) => (m.id === entryId ? fn(m) : m))
}

/** Update a tool call within a message by matching name/id.
 *  First tries the entry with matching entryId, then falls back to searching all messages. */
export function updateToolCall(
  messages: ConversationEntry[],
  entryId: string,
  toolName: string,
  toolCallId: string | undefined,
  fn: (tc: ToolCallEntry) => ToolCallEntry
): ConversationEntry[] {
  // Try the specified entry first
  const target = messages.find((m) => m.id === entryId)
  if (
    target?.toolCalls?.some((tc) => matchesToolCall(tc, toolName, toolCallId))
  ) {
    return updateMessage(messages, entryId, (m) => ({
      ...m,
      toolCalls: m.toolCalls?.map((tc) =>
        matchesToolCall(tc, toolName, toolCallId) ? fn(tc) : tc
      ),
    }))
  }
  // Fallback: search all messages
  return messages.map((m) => ({
    ...m,
    toolCalls: m.toolCalls?.map((tc) =>
      matchesToolCall(tc, toolName, toolCallId) ? fn(tc) : tc
    ),
  }))
}

export function createUserEntry(
  text: string,
  attachments?: FileAttachment[]
): ConversationEntry {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    content: text,
    timestamp: Date.now(),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  }
}

export function createAssistantEntry(entryId: string): ConversationEntry {
  return {
    id: entryId,
    role: "assistant",
    content: "",
    reasoningContent: "",
    toolCalls: [],
    timestamp: Date.now(),
    isStreaming: true,
  }
}

export function createCompactionEntry(summary: string): ConversationEntry {
  return {
    id: `compaction-${Date.now()}`,
    role: "system",
    content: "",
    compactionSummary: summary,
    timestamp: Date.now(),
  }
}
