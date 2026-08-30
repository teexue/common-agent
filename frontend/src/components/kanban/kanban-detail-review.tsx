import { useTranslation } from "react-i18next"
import { Check, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  approveKanbanItem,
  rejectKanbanItem,
  requeueKanbanItem,
} from "@/lib/api"
import type { KanbanItem } from "@/types/agent"
import { KanbanEyebrow } from "./kanban-sheet"

export function KanbanDetailReview({
  item,
  feedback,
  setFeedback,
  busy,
  runAction,
}: {
  item: KanbanItem
  feedback: string
  setFeedback: (v: string) => void
  busy: boolean
  runAction: (fn: () => Promise<unknown>) => Promise<void>
}) {
  if (item.status === "review") {
    return (
      <ReviewBand
        item={item}
        feedback={feedback}
        setFeedback={setFeedback}
        busy={busy}
        runAction={runAction}
      />
    )
  }
  if (item.status === "failed") {
    return <FailedBand item={item} busy={busy} runAction={runAction} />
  }
  return null
}

function FailedBand({
  item,
  busy,
  runAction,
}: {
  item: KanbanItem
  busy: boolean
  runAction: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/50 pt-5">
      <p className="text-xs text-muted-foreground">{t("kanban.failedHint")}</p>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={busy}
        onClick={() => void runAction(() => requeueKanbanItem(item.id))}
      >
        <RotateCcw className="h-3.5 w-3.5" /> {t("kanban.requeue")}
      </Button>
    </div>
  )
}

function ReviewBand({
  item,
  feedback,
  setFeedback,
  busy,
  runAction,
}: {
  item: KanbanItem
  feedback: string
  setFeedback: (v: string) => void
  busy: boolean
  runAction: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-8 space-y-3 border-t border-border/50 pt-5">
      <KanbanEyebrow>{t("kanban.feedbackLabel")}</KanbanEyebrow>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        className="rounded-xl bg-muted/40 text-sm"
        placeholder={t("kanban.feedbackPlaceholder")}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => void runAction(() => approveKanbanItem(item.id))}
        >
          <Check className="h-3.5 w-3.5" /> {t("common.approve")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={!feedback.trim() || busy}
          onClick={() => {
            if (!feedback.trim()) return
            setFeedback("")
            void runAction(() => rejectKanbanItem(item.id, feedback.trim()))
          }}
        >
          <X className="h-3.5 w-3.5" /> {t("kanban.rejectSubmit")}
        </Button>
      </div>
    </div>
  )
}
