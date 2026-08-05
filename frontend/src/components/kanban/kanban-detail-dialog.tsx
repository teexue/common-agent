import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, History, RotateCcw, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SessionReplay } from "@/components/sessions/session-replay"
import type { KanbanItem } from "@/types/agent"

interface KanbanDetailDialogProps {
  item: KanbanItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string) => void
  onReject: (id: string, feedback: string) => void
  onRequeue: (id: string) => void
  onDelete: (id: string) => void
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px] text-foreground">{value}</span>
    </div>
  )
}

function formatTime(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

/** Dialog showing full kanban task details with review/requeue/replay actions. */
export function KanbanDetailDialog({
  item, open, onOpenChange, onApprove, onReject, onRequeue, onDelete,
}: KanbanDetailDialogProps) {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState("")
  const [replayOpen, setReplayOpen] = useState(false)

  if (!item) return null

  const statusLabel = t(`kanban.col${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)

  const handleReject = () => {
    if (!feedback.trim()) return
    onReject(item.id, feedback.trim())
    setFeedback("")
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <Badge variant="secondary" className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px]">{statusLabel}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground">{t("kanban.fieldPrompt")}</p>
              <p className="whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 leading-relaxed text-foreground">{item.prompt}</p>
            </div>

            {item.result && (
              <div className="space-y-1">
                <p className="text-muted-foreground">{t("kanban.resultLabel")}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 leading-relaxed text-foreground">{item.result}</p>
              </div>
            )}

            {item.feedback && (
              <div className="space-y-1">
                <p className="text-muted-foreground">{t("kanban.feedbackLabel")}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 leading-relaxed text-foreground">{item.feedback}</p>
              </div>
            )}

            {(item.tags ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}

            <div className="space-y-1 rounded-xl border border-border/60 px-3 py-2">
              <MetaRow label={t("kanban.fieldAgent")} value={item.agent} />
              {item.workdir && <MetaRow label={t("kanban.fieldWorkdir")} value={item.workdir} />}
              {item.due_at && <MetaRow label={t("kanban.dueAt")} value={formatTime(item.due_at)} />}
              <MetaRow label={t("kanban.createdAt")} value={formatTime(item.created_at)} />
              <MetaRow label={t("kanban.updatedAt")} value={formatTime(item.updated_at)} />
              {item.finished_at && <MetaRow label={t("kanban.finishedAt")} value={formatTime(item.finished_at)} />}
              {item.attempts > 0 && <MetaRow label={t("kanban.attempts", { count: item.attempts })} value="" />}
            </div>

            {item.status === "review" && (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("kanban.feedbackLabel")}</Label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                    className="rounded-lg text-sm"
                    placeholder={t("kanban.feedbackPlaceholder")}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 flex-1 gap-1.5 rounded-xl text-xs" onClick={() => onApprove(item.id)}>
                    <Check className="h-3.5 w-3.5" /> {t("common.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 gap-1.5 rounded-xl text-xs"
                    disabled={!feedback.trim()}
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" /> {t("kanban.rejectSubmit")}
                  </Button>
                </div>
              </div>
            )}

            {item.status === "failed" && (
              <div className="border-t border-border/60 pt-3">
                <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 rounded-xl text-xs" onClick={() => onRequeue(item.id)}>
                  <RotateCcw className="h-3.5 w-3.5" /> {t("kanban.requeue")}
                </Button>
              </div>
            )}

            <div className="flex gap-2 border-t border-border/60 pt-3">
              {item.session_id && (
                <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 rounded-xl text-xs" onClick={() => setReplayOpen(true)}>
                  <History className="h-3.5 w-3.5" /> {t("kanban.viewReplay")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-xl text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SessionReplay sessionId={item.session_id ?? null} open={replayOpen} onOpenChange={setReplayOpen} />
    </>
  )
}
