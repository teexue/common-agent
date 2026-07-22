import { useTranslation } from "react-i18next"
import { Clock, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SessionMeta } from "@/types/agent"
import { formatRelativeTime } from "@/lib/format"

interface SessionListProps {
  sessions: SessionMeta[]
  activeSessionId?: string | null
  onResumeSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onReplaySession?: (id: string) => void
  agentLabels?: Record<string, string>
}

function SessionActionBtn({ tooltip, onClick, children }: { tooltip: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onClick} className="h-5 w-5 rounded-md" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function SessionListItem({
  sess, active, onResume, onDelete, onReplay, agentLabel,
}: {
  sess: SessionMeta; active: boolean
  onResume?: (id: string) => void; onDelete?: (id: string) => void; onReplay?: (id: string) => void
  agentLabel?: string
}) {
  const { t } = useTranslation()
  const title = sess.title?.trim() || t("layout.untitledSession")
  return (
    <div className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all ${active ? "bg-primary/8 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
      <button onClick={() => onResume?.(sess.id)} className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${active ? "bg-primary" : "bg-muted-foreground/25 group-hover:bg-primary/40"}`} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {agentLabel || sess.agent} · {formatRelativeTime(sess.updated_at)}
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onReplay && (
          <SessionActionBtn tooltip={t("layout.replaySession")} onClick={(e) => { e.stopPropagation(); onReplay(sess.id) }}>
            <Play className="h-3 w-3 text-muted-foreground" />
          </SessionActionBtn>
        )}
        {onDelete && (
          <SessionActionBtn tooltip={t("layout.deleteSession")} onClick={(e) => { e.stopPropagation(); onDelete(sess.id) }}>
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </SessionActionBtn>
        )}
      </div>
    </div>
  )
}

export function SessionList({
  sessions, activeSessionId, onResumeSession, onDeleteSession, onReplaySession, agentLabels,
}: SessionListProps) {
  const { t } = useTranslation()
  if (sessions.length === 0) return null

  return (
    <div className="p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        <Clock className="h-3 w-3" /> {t("layout.historySessions")}
      </div>
      <div className="flex flex-col gap-0.5">
        {sessions.map((sess) => (
          <SessionListItem
            key={sess.id}
            sess={sess}
            active={activeSessionId === sess.id}
            onResume={onResumeSession}
            onDelete={onDeleteSession}
            onReplay={onReplaySession}
            agentLabel={agentLabels?.[sess.agent]}
          />
        ))}
      </div>
    </div>
  )
}
