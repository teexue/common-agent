export const SUBAGENT_TOOL = "delegate_task"

export function isSubAgentCall(tc: { name: string; status?: string }): boolean {
  return (
    tc.name === SUBAGENT_TOOL ||
    tc.status === "sub_agent_queued" ||
    tc.status === "sub_agent_running"
  )
}
