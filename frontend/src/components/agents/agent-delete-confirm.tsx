import { useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteAgent } from "@/lib/api"

interface AgentDeleteConfirmProps {
  agentName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function AgentDeleteConfirm({
  agentName,
  open,
  onOpenChange,
  onDeleted,
}: AgentDeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!agentName) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAgent(agentName)
      onDeleted?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            删除 Agent
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            确定要删除 Agent{" "}
            <span className="font-mono font-medium text-foreground">
              {agentName}
            </span>{" "}
            吗？此操作不可撤销。
          </p>

          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 rounded-lg text-xs"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
