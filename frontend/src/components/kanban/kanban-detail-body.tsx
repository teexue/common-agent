import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import type { KanbanItem } from "@/types/agent"
import { KanbanDetailMeta } from "./kanban-detail-meta"
import { KanbanDetailReview } from "./kanban-detail-review"

export function KanbanDetailBody({
  item,
  error,
  feedback,
  setFeedback,
  busy,
  runAction,
}: {
  item: KanbanItem
  error: string | null
  feedback: string
  setFeedback: (v: string) => void
  busy: boolean
  runAction: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 text-xs">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <StatusBadges item={item} />
      <PromptBlock label={t("kanban.fieldPrompt")} text={item.prompt} />
      {item.result && <ResultBlock content={item.result} />}
      {item.feedback && (
        <PromptBlock label={t("kanban.feedbackLabel")} text={item.feedback} />
      )}
      <KanbanDetailMeta item={item} />
      <KanbanDetailReview
        item={item}
        feedback={feedback}
        setFeedback={setFeedback}
        busy={busy}
        runAction={runAction}
      />
    </div>
  )
}

function StatusBadges({ item }: { item: KanbanItem }) {
  const { t } = useTranslation()
  const statusLabel = t(
    `kanban.col${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`
  )
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="secondary"
        className="rounded-md px-1.5 py-0.5 text-[10px]"
      >
        {statusLabel}
      </Badge>
      {(item.tags ?? []).map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="rounded-md px-1.5 py-0.5 text-[10px]"
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}

function ResultBlock({ content }: { content: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{t("kanban.resultLabel")}</p>
      <div className="max-h-96 overflow-y-auto rounded-lg bg-muted/40 px-3 py-2 leading-relaxed text-foreground">
        <MarkdownRenderer content={content} isStreaming={false} />
      </div>
    </div>
  )
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="rounded-lg bg-muted/40 px-3 py-2 leading-relaxed whitespace-pre-wrap text-foreground">
        {text}
      </p>
    </div>
  )
}
