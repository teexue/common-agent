import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ActivityEntry } from "@/components/conversation/activity-entry"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { buildVisibleEntries } from "@/lib/replay-parser"
import type { ReplayEntry } from "@/types/replay"

interface ConversationPanelProps {
  entries: ReplayEntry[]
  currentEventIndex: number
}

export function ConversationPanel({ entries, currentEventIndex }: ConversationPanelProps) {
  const { t } = useTranslation()
  const { containerRef, handleScroll } = useAutoScroll(currentEventIndex)

  const visibleEntries = useMemo(
    () => buildVisibleEntries(entries, currentEventIndex),
    [entries, currentEventIndex],
  )

  if (visibleEntries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {t("replay.noConversation")}
      </div>
    )
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-auto">
      <div className="flex flex-col gap-5 p-5">
        {visibleEntries.map((entry) => (
          <ActivityEntry
            key={entry.id}
            entry={entry}
            selectedToolCallId={null}
            onSelectToolCall={() => {}}
          />
        ))}
      </div>
    </div>
  )
}
