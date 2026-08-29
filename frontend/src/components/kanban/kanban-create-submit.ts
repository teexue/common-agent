import { createKanbanItem } from "@/lib/api"
import type { AgentInfo } from "@/types/agent"

export interface KanbanCreateFieldsState {
  agents: AgentInfo[]
  title: string
  setTitle: (v: string) => void
  prompt: string
  setPrompt: (v: string) => void
  agent: string
  setAgent: (v: string) => void
  priority: number
  setPriority: (v: number) => void
}

export async function submitKanbanCreate(opts: {
  title: string
  prompt: string
  agent: string
  workdir: string
  priority: number
  tags: string
  dueAt: string
  onCreated: () => void
  setError: (msg: string) => void
  setSaving: (v: boolean) => void
}) {
  opts.setError("")
  opts.setSaving(true)
  try {
    await createKanbanItem({
      title: opts.title.trim(),
      prompt: opts.prompt.trim(),
      agent: opts.agent,
      workdir: opts.workdir.trim() || undefined,
      priority: opts.priority,
      tags: opts.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      due_at: opts.dueAt
        ? new Date(`${opts.dueAt}T00:00:00`).toISOString()
        : undefined,
    })
    opts.onCreated()
  } catch (err) {
    opts.setError(err instanceof Error ? err.message : String(err))
    opts.setSaving(false)
  }
}
