import { isSubAgentCall, SUBAGENT_TOOL } from "@/lib/sub-agent"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"
import type { ChatAction, ChatState } from "./chat-state-types"
import { updateMessage } from "./chat-state-helpers"

function isOpenSubAgentStatus(status: string): boolean {
  return (
    status === "running" ||
    status === "sub_agent_queued" ||
    status === "sub_agent_running"
  )
}

function findSubAgent(
  calls: ToolCallEntry[] | undefined,
  toolCallId?: string
): ToolCallEntry | undefined {
  if (!calls) return
  if (toolCallId) {
    const byId = calls.find(
      (tc) => isSubAgentCall(tc) && tc.toolCallId === toolCallId
    )
    if (byId) return byId
  }
  for (let i = calls.length - 1; i >= 0; i--) {
    const tc = calls[i]
    if (isSubAgentCall(tc) && isOpenSubAgentStatus(tc.status)) return tc
  }
}

function mapMatchingSubAgent(
  calls: ToolCallEntry[],
  toolCallId: string | undefined,
  fn: (tc: ToolCallEntry) => ToolCallEntry
): ToolCallEntry[] {
  const target = findSubAgent(calls, toolCallId)
  if (!target) return calls
  return calls.map((tc) => (tc.id === target.id ? fn(tc) : tc))
}

function findSubAgentMessage(
  messages: ConversationEntry[],
  toolCallId?: string
): ConversationEntry | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (findSubAgent(messages[i].toolCalls, toolCallId)) return messages[i]
  }
}

function actionToolCallId(
  action: ChatAction & { type: `SUB_AGENT_${string}` }
): string | undefined {
  if (action.type === "SUB_AGENT_START") return action.toolCall.toolCallId
  return action.toolCallId
}

/** Handles SUB_AGENT_START and SUB_AGENT_END on the existing delegate card. */
export function reduceSubAgentAction(
  state: ChatState,
  action: ChatAction & { type: `SUB_AGENT_${string}` }
): ChatState {
  const toolCallId = actionToolCallId(action)
  const target = findSubAgentMessage(state.messages, toolCallId)
  const entryId = target?.id ?? action.entryId
  if (action.type === "SUB_AGENT_START") {
    return reduceSubAgentStart(state, action, entryId, !!target)
  }
  return {
    ...state,
    messages: patchEntryTools(state.messages, entryId, (calls) =>
      mapMatchingSubAgent(calls, toolCallId, (tc) => ({
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
  const queued = action.toolCall.status === "sub_agent_queued"
  if (hasOpen) {
    return {
      ...state,
      messages: patchEntryTools(state.messages, entryId, (calls) =>
        mapMatchingSubAgent(calls, action.toolCall.toolCallId, (tc) => ({
          ...tc,
          sessionId: action.toolCall.sessionId ?? tc.sessionId,
          status: queued ? "sub_agent_queued" : "sub_agent_running",
          queueMax: action.toolCall.queueMax ?? tc.queueMax,
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
