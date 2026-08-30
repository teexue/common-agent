import type { KanbanStatus } from "@/types/agent"

/** Lane accent — pipeline order pending → running → review → done | failed. */
export const KANBAN_LANE_TICK: Record<KanbanStatus, string> = {
  pending: "bg-muted-foreground/40",
  running: "bg-primary",
  review: "bg-warning",
  done: "bg-success",
  failed: "bg-destructive",
}

export function kanbanPriorityRail(priority: number): string {
  if (priority >= 3) return "border-l-destructive"
  if (priority === 2) return "border-l-warning"
  return "border-l-border"
}

export function kanbanStatusKey(status: KanbanStatus): string {
  return `kanban.col${status.charAt(0).toUpperCase()}${status.slice(1)}`
}
