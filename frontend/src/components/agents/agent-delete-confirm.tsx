import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteAgent } from "@/lib/api"

interface AgentDeleteConfirmProps {
  agentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function AgentDeleteConfirm({ agentId, open, onOpenChange, onDeleted }: AgentDeleteConfirmProps) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!agentId) return
    setDeleting(true); setError(null)
    try {
      await deleteAgent(agentId)
      onDeleted?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("agent.errDelete"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" /> {t("agent.deleteTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("agent.deleteConfirm", { name: agentId })}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => onOpenChange(false)} disabled={deleting}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
