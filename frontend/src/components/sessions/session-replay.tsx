import { useEffect, useState } from "react"
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { fetchSessionReplay } from "@/lib/api"
import type { ReplayEvent } from "@/types/agent"

interface SessionReplayProps {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function TurnFilter({ fromTurn, toTurn, onFromChange, onToChange, count }: { fromTurn: string; toTurn: string; onFromChange: (v: string) => void; onToChange: (v: string) => void; count: number }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">起始轮次</Label>
        <Input value={fromTurn} onChange={(e) => onFromChange(e.target.value)} placeholder="0" type="number" className="h-8 w-24 rounded-lg font-mono text-xs" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">结束轮次</Label>
        <Input value={toTurn} onChange={(e) => onToChange(e.target.value)} placeholder="全部" type="number" className="h-8 w-24 rounded-lg font-mono text-xs" />
      </div>
      <span className="pb-1.5 text-[10px] text-muted-foreground">共 {count} 条事件</span>
    </div>
  )
}

export function SessionReplay({ sessionId, open, onOpenChange }: SessionReplayProps) {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromTurn, setFromTurn] = useState("")
  const [toTurn, setToTurn] = useState("")
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open || !sessionId) { setEvents([]); setError(null); return }
    setLoading(true); setError(null)
    const from = fromTurn ? parseInt(fromTurn, 10) : undefined
    const to = toTurn ? parseInt(toTurn, 10) : undefined
    fetchSessionReplay(sessionId, from, to).then(setEvents).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [open, sessionId, fromTurn, toTurn])

  const toggleExpanded = (index: number) => {
    setExpandedEvents((prev) => { const next = new Set(prev); next.has(index) ? next.delete(index) : next.add(index); return next })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight"><Play className="h-4 w-4 text-primary" /> 会话回放</DialogTitle>
        </DialogHeader>
        <TurnFilter fromTurn={fromTurn} toTurn={toTurn} onFromChange={setFromTurn} onToChange={setToTurn} count={events.length} />
        <Separator />
        {loading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>}
        {!loading && !error && events.length === 0 && <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">暂无回放事件</div>}
        {!loading && events.length > 0 && (
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-2">
              {events.map((record, index) => <ReplayEventRow key={index} record={record} expanded={expandedEvents.has(index)} onToggle={() => toggleExpanded(index)} />)}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Replay Event Row ─────────────────────────────────────────────

function EventDetail({ event }: { event: ReplayEvent["event"] }) {
  return (
    <div className="border-t border-border px-3 py-2">
      {event.content && <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">{String(event.content)}</p>}
      {event.input != null && (
        <div className="mt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">输入</span>
          <pre className="mt-0.5 max-h-32 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">{JSON.stringify(event.input, null, 2)}</pre>
        </div>
      )}
      {event.output != null && (
        <div className="mt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">输出</span>
          <pre className="mt-0.5 max-h-32 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">{JSON.stringify(event.output, null, 2)}</pre>
        </div>
      )}
      {event.message && <p className="mt-1 text-xs text-destructive">{String(event.message)}</p>}
    </div>
  )
}

function ReplayEventRow({ record, expanded, onToggle }: { record: ReplayEvent; expanded: boolean; onToggle: () => void }) {
  const { event, turn, ts } = record
  const time = new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const config = getEventConfig(event.type)

  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:border-primary/15">
      <button onClick={onToggle} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${config.bg}`}>
          <config.icon className={`h-3 w-3 ${config.color}`} />
        </div>
        <span className="flex-1 truncate font-mono text-xs text-foreground">{config.label}</span>
        {event.tool && <Badge variant="secondary" className="rounded-md px-1.5 py-0 font-mono text-[9px]">{event.tool}</Badge>}
        {turn > 0 && <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[9px]">T{turn}</Badge>}
        <span className="font-mono text-[10px] text-muted-foreground">{time}</span>
      </button>
      {expanded && <EventDetail event={event} />}
    </div>
  )
}

// ─── Event Config ─────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { icon: typeof Bot; color: string; bg: string; label: string }> = {
  text_delta: { icon: Bot, color: "text-primary", bg: "bg-primary/10", label: "文本输出" },
  reasoning_delta: { icon: Bot, color: "text-violet-500", bg: "bg-violet-500/10", label: "推理过程" },
  tool_start: { icon: Wrench, color: "text-blue-500", bg: "bg-blue-500/10", label: "工具调用开始" },
  tool_result: { icon: Wrench, color: "text-success", bg: "bg-success/10", label: "工具调用结果" },
  tool_approval_required: { icon: Wrench, color: "text-warning", bg: "bg-warning/10", label: "工具待审批" },
  compaction: { icon: Bot, color: "text-amber-500", bg: "bg-amber-500/10", label: "上下文压缩" },
  sub_agent_start: { icon: Bot, color: "text-blue-500", bg: "bg-blue-500/10", label: "子 Agent 开始" },
  sub_agent_end: { icon: Bot, color: "text-success", bg: "bg-success/10", label: "子 Agent 结束" },
  error: { icon: Bot, color: "text-destructive", bg: "bg-destructive/10", label: "错误" },
  done: { icon: Bot, color: "text-muted-foreground", bg: "bg-muted", label: "完成" },
}

const DEFAULT_EVENT_CONFIG = { icon: Bot, color: "text-muted-foreground", bg: "bg-muted" }

function getEventConfig(type: string) {
  return EVENT_CONFIG[type] ?? { ...DEFAULT_EVENT_CONFIG, label: type }
}
