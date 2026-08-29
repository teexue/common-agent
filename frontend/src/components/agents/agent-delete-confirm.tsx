import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  agentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function AgentDeleteConfirm({
  agentId,
  open,
  onOpenChange,
  onDeleted,
}: AgentDeleteConfirmProps) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />{" "}
            {t("agent.deleteTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("agent.deleteConfirm", { name: agentId })}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DeleteFooter
          deleting={deleting}
          onCancel={() => onOpenChange(false)}
          onConfirm={() =>
            void runDelete({
              agentId,
              setDeleting,
              setError,
              onDeleted,
              onOpenChange,
              t,
            })
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function DeleteFooter({
  deleting,
  onCancel,
  onConfirm,
}: {
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <DialogFooter className="gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={onCancel}
        disabled={deleting}
      >
        {t("common.cancel")}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onConfirm}
        disabled={deleting}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {t("common.delete")}
      </Button>
    </DialogFooter>
  )
}

async function runDelete(opts: {
  agentId: string | null
  setDeleting: (v: boolean) => void
  setError: (v: string | null) => void
  onDeleted?: () => void
  onOpenChange: (open: boolean) => void
  t: (key: string) => string
}) {
  if (!opts.agentId) return
  opts.setDeleting(true)
  opts.setError(null)
  try {
    await deleteAgent(opts.agentId)
    opts.onDeleted?.()
    opts.onOpenChange(false)
  } catch (err: unknown) {
    opts.setError(
      err instanceof Error ? err.message : opts.t("agent.errDelete")
    )
  } finally {
    opts.setDeleting(false)
  }
}
