import { useTranslation } from "react-i18next"
import { Check, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  approveKanbanItem,
  rejectKanbanItem,
  requeueKanbanItem,
} from "@/lib/api"
import type { KanbanItem } from "@/types/agent"

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
      <ReviewActions
        item={item}
        feedback={feedback}
        setFeedback={setFeedback}
        busy={busy}
        runAction={runAction}
      />
    )
  }
  if (item.status === "failed") {
    return (
      <div className="border-t border-border/60 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          disabled={busy}
          onClick={() => void runAction(() => requeueKanbanItem(item.id))}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <RequeueLabel />
        </Button>
      </div>
    )
  }
  return null
}

function RequeueLabel() {
  const { t } = useTranslation()
  return <>{t("kanban.requeue")}</>
}

function ReviewActions({
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
    <div className="space-y-2 border-t border-border/60 pt-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("kanban.feedbackLabel")}
        </Label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="rounded-lg text-sm"
          placeholder={t("kanban.feedbackPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => void runAction(() => approveKanbanItem(item.id))}
        >
          <Check className="h-3.5 w-3.5" /> {t("common.approve")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
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
