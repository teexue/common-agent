import { isSubAgentCall, SUBAGENT_TOOL } from "@/lib/sub-agent"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"
import type { ChatAction, ChatState } from "./chat-state-types"
import { updateMessage } from "./chat-state-helpers"

function lastOpenSubAgent(
  calls: ToolCallEntry[] | undefined
): ToolCallEntry | undefined {
  if (!calls) return
  for (let i = calls.length - 1; i >= 0; i--) {
    const tc = calls[i]
    if (
      isSubAgentCall(tc) &&
      (tc.status === "running" || tc.status === "sub_agent_running")
    ) {
      return tc
    }
  }
}

function mapOpenSubAgent(
  calls: ToolCallEntry[],
  fn: (tc: ToolCallEntry) => ToolCallEntry
): ToolCallEntry[] {
  const target = lastOpenSubAgent(calls)
  if (!target) return calls
  return calls.map((tc) => (tc.id === target.id ? fn(tc) : tc))
}

function findOpenSubAgentMessage(
  messages: ConversationEntry[]
): ConversationEntry | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastOpenSubAgent(messages[i].toolCalls)) return messages[i]
  }
}

/** Handles SUB_AGENT_START and SUB_AGENT_END on the existing delegate card. */
export function reduceSubAgentAction(
  state: ChatState,
  action: ChatAction & { type: `SUB_AGENT_${string}` }
): ChatState {
  const target = findOpenSubAgentMessage(state.messages)
  const entryId = target?.id ?? action.entryId
  if (action.type === "SUB_AGENT_START") {
    return reduceSubAgentStart(state, action, entryId, !!target)
  }
  return {
    ...state,
    messages: patchEntryTools(state.messages, entryId, (calls) =>
      mapOpenSubAgent(calls, (tc) => ({
        ...tc,
        status: "completed",
        endTime: Date.now(),
        sessionId: action.sessionId ?? tc.sessionId,
      }))
    ),
  }
}

function reduceSubAgentStart(
  state: ChatState,
  action: ChatAction & { type: "SUB_AGENT_START" },
  entryId: string,
  hasOpen: boolean
): ChatState {
  if (hasOpen) {
    return {
      ...state,
      messages: patchEntryTools(state.messages, entryId, (calls) =>
        mapOpenSubAgent(calls, (tc) => ({
          ...tc,
          sessionId: action.toolCall.sessionId ?? tc.sessionId,
          status: "sub_agent_running",
        }))
      ),
    }
  }
  const call = { ...action.toolCall, name: SUBAGENT_TOOL }
  return {
    ...state,
    messages: updateMessage(state.messages, action.entryId, (m) => ({
      ...m,
      toolCalls: [...(m.toolCalls ?? []), call],
    })),
  }
}

function patchEntryTools(
  messages: ConversationEntry[],
  entryId: string,
  fn: (calls: ToolCallEntry[]) => ToolCallEntry[]
): ConversationEntry[] {
  return updateMessage(messages, entryId, (m) => ({
    ...m,
    toolCalls: fn(m.toolCalls ?? []),
  }))
}
