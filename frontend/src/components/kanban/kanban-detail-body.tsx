import { useTranslation } from "react-i18next"
import { ConversationThread } from "@/components/conversation/conversation-thread"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import type { ConversationEntry, KanbanItem } from "@/types/agent"
import { cn } from "@/lib/utils"
import { KanbanDetailMeta } from "./kanban-detail-meta"
import { KanbanDetailReview } from "./kanban-detail-review"
import { KANBAN_LANE_TICK, kanbanStatusKey } from "./kanban-lane"
import { KanbanEyebrow, KanbanSheet } from "./kanban-sheet"

export function KanbanDetailBody({
  item,
  messages,
  isStreaming,
  error,
  feedback,
  setFeedback,
  busy,
  runAction,
}: {
  item: KanbanItem
  messages: ConversationEntry[]
  isStreaming: boolean
  error: string | null
  feedback: string
  setFeedback: (v: string) => void
  busy: boolean
  runAction: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <KanbanSheet>
      {error && (
        <p className="mb-5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <Masthead item={item} />
      <h2 className="mt-4 font-heading text-[1.65rem] leading-snug tracking-tight text-foreground">
        {item.title}
      </h2>
      <TaskRun item={item} messages={messages} isStreaming={isStreaming} />
      {item.feedback && (
        <section className="mt-8 border-t border-border/50 pt-6">
          <KanbanEyebrow>{t("kanban.feedbackLabel")}</KanbanEyebrow>
          <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-foreground">
            {item.feedback}
          </p>
        </section>
      )}
      <KanbanDetailMeta item={item} />
      <KanbanDetailReview
        item={item}
        feedback={feedback}
        setFeedback={setFeedback}
        busy={busy}
        runAction={runAction}
      />
    </KanbanSheet>
  )
}

function TaskRun({
  item,
  messages,
  isStreaming,
}: {
  item: KanbanItem
  messages: ConversationEntry[]
  isStreaming: boolean
}) {
  const { t } = useTranslation()
  if (messages.length > 0) {
    return (
      <section className="mt-8 border-t border-border/50 pt-6">
        <ConversationThread messages={messages} isStreaming={isStreaming} />
      </section>
    )
  }
  return (
    <>
      <section className="mt-8">
        <KanbanEyebrow>{t("kanban.fieldPrompt")}</KanbanEyebrow>
        <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-foreground">
          {item.prompt}
        </p>
      </section>
      {isStreaming && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          {t("kanban.waitingStart")}
        </p>
      )}
      {item.result && <ResultFallback content={item.result} />}
    </>
  )
}

function Masthead({ item }: { item: KanbanItem }) {
  const { t } = useTranslation()
  const tags = item.tags ?? []
  const priorityLabel =
    item.priority === 3
      ? t("kanban.priorityHigh")
      : item.priority === 2
        ? t("kanban.priorityMedium")
        : t("kanban.priorityLow")
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "h-3.5 w-0.5 rounded-full",
          KANBAN_LANE_TICK[item.status],
          item.status === "running" && "animate-pulse"
        )}
      />
      <span className="text-foreground">{t(kanbanStatusKey(item.status))}</span>
      <span aria-hidden="true">·</span>
      <span className="font-mono">{item.agent}</span>
      <span aria-hidden="true">·</span>
      <span>{priorityLabel}</span>
      {tags.map((tag) => (
        <span key={tag}>· {tag}</span>
      ))}
    </div>
  )
}

function ResultFallback({ content }: { content: string }) {
  const { t } = useTranslation()
  return (
    <section className="mt-8 border-t border-border/50 pt-6">
      <KanbanEyebrow>{t("kanban.resultLabel")}</KanbanEyebrow>
      <div className="mt-3 text-sm leading-7">
        <MarkdownRenderer content={content} isStreaming={false} />
      </div>
    </section>
  )
}
