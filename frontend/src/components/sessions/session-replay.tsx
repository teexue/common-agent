import { useEffect, useMemo, useState } from "react"
import { Loader2, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { fetchSessionReplay } from "@/lib/api"
import { parseReplayEvents } from "@/lib/replay-parser"
import { usePlayback } from "@/hooks/use-playback"
import type { ReplayEvent } from "@/types/agent"
import type { PlaybackSpeed } from "@/types/replay"
import { AuditTreePanel } from "./replay/audit-tree-panel"
import { ConversationPanel } from "./replay/conversation-panel"
import { ReplayToolbar } from "./replay/replay-toolbar"

interface SessionReplayProps {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionReplay({ sessionId, open, onOpenChange }: SessionReplayProps) {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromTurn, setFromTurn] = useState("")
  const [toTurn, setToTurn] = useState("")

  const playback = usePlayback(events.length)
  const parsed = useMemo(() => parseReplayEvents(events), [events])

  useEffect(() => {
    playback.reset()
  }, [sessionId, open, playback.reset])

  useEffect(() => {
    if (!open || !sessionId) {
      setEvents([]); setError(null); return
    }
    setLoading(true); setError(null)
    const from = fromTurn ? parseInt(fromTurn, 10) : undefined
    const to = toTurn ? parseInt(toTurn, 10) : undefined
    fetchSessionReplay(sessionId, from, to)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, sessionId, fromTurn, toTurn])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case " ":
          e.preventDefault(); playback.toggle(); break
        case "ArrowRight":
          e.preventDefault(); playback.stepForward(); break
        case "ArrowLeft":
          e.preventDefault(); playback.stepBackward(); break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, playback])

  const handleSeekProgress = (ratio: number) => {
    playback.seekTo(Math.round(ratio * (events.length - 1)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl border-border bg-card sm:!max-w-5xl">
        <div className="flex max-h-[80vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight">
              <Play className="h-4 w-4 text-primary" />
              会话回放
            </DialogTitle>
          </DialogHeader>

          <TurnFilter
            fromTurn={fromTurn}
            toTurn={toTurn}
            onFromChange={setFromTurn}
            onToChange={setToTurn}
            count={events.length}
          />

          <Separator />

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              暂无回放事件
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <ReplayToolbar
                isPlaying={playback.isPlaying}
                currentIndex={playback.currentIndex}
                totalCount={events.length}
                speed={playback.speed}
                progress={playback.progress}
                onToggle={playback.toggle}
                onStepBack={playback.stepBackward}
                onStepForward={playback.stepForward}
                onReset={playback.reset}
                onSpeedChange={(s: PlaybackSpeed) => playback.setSpeed(s)}
                onSeekProgress={handleSeekProgress}
              />
              <div className="flex min-h-0 flex-1">
                <div className="w-[35%] shrink-0 overflow-auto border-r border-border">
                  <AuditTreePanel
                    turnNodes={parsed.turnNodes}
                    currentIndex={playback.currentIndex}
                    onSeek={playback.seekTo}
                  />
                </div>
                <div className="min-w-0 flex-1 overflow-auto">
                  <ConversationPanel
                    entries={parsed.replayEntries}
                    currentEventIndex={playback.currentIndex}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Turn Filter ──────────────────────────────────────────────────

function TurnFilter({ fromTurn, toTurn, onFromChange, onToChange, count }: {
  fromTurn: string
  toTurn: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  count: number
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          起始轮次
        </Label>
        <Input
          value={fromTurn}
          onChange={(e) => onFromChange(e.target.value)}
          placeholder="0"
          type="number"
          className="h-8 w-24 rounded-lg font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          结束轮次
        </Label>
        <Input
          value={toTurn}
          onChange={(e) => onToChange(e.target.value)}
          placeholder="全部"
          type="number"
          className="h-8 w-24 rounded-lg font-mono text-xs"
        />
      </div>
      <span className="pb-1.5 text-[10px] text-muted-foreground">共 {count} 条事件</span>
    </div>
  )
}
