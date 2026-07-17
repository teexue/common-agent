import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  GitMerge,
  Shield,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditNode, TurnNode } from "@/types/replay"
import type { TFunction } from "i18next"
import { ToolCallCard } from "./tool-call-card"

interface AuditTreeNodeProps {
  turnNode: TurnNode
  currentIndex: number
  onSeek: (index: number) => void
}

export function AuditTreeNode({ turnNode, currentIndex, onSeek }: AuditTreeNodeProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)

  const visibleCount = turnNode.nodes.filter((n) => nodeEventIndex(n) <= currentIndex).length
  const hasActive = visibleCount > 0
  const allDone = turnNode.nodes.length > 0 && visibleCount === turnNode.nodes.length

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
          hasActive && !allDone ? "bg-primary/5" : "hover:bg-muted/50",
        )}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded",
          allDone ? "bg-success/10" : hasActive ? "bg-primary/10" : "bg-muted",
        )}>
          {allDone
            ? <CheckCircle className="h-3 w-3 text-success" />
            : <span className="text-[10px] font-bold text-primary">{turnNode.turn}</span>}
        </div>
        <span className="flex-1 text-xs font-medium">{t("replay.turn", { turn: turnNode.turn })}</span>
        <span className="text-[10px] text-muted-foreground">
          {visibleCount}/{turnNode.nodes.length}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-1 border-l border-border pl-3">
          {turnNode.nodes.map((node, i) => (
            <AuditLeafNode
              key={i}
              node={node}
              active={nodeEventIndex(node) <= currentIndex}
              highlight={nodeEventIndex(node) === currentIndex}
              onSeek={onSeek}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AuditLeafNode({ node, active, highlight, onSeek }: {
  node: AuditNode
  active: boolean
  highlight: boolean
  onSeek: (index: number) => void
}) {
  const { t } = useTranslation()
  const idx = nodeEventIndex(node)

  if (node.type === "tool_call") {
    return (
      <div className={cn("opacity-100 transition-opacity", !active && "opacity-30")}>
        <ToolCallCard
          node={node}
          compact
          highlight={highlight}
          eventIndex={node.startIndex}
          onJump={onSeek}
        />
      </div>
    )
  }

  if (node.type === "text") {
    if (!node.content) return null
    const preview = node.content.length > 40 ? node.content.slice(0, 40) + "…" : node.content
    return (
      <button
        onClick={() => onSeek(idx)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
          highlight ? "bg-primary/10" : "hover:bg-muted/30",
          !active && "opacity-30",
        )}
        data-event-index={idx}
      >
        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-[11px] text-muted-foreground">{preview}</span>
      </button>
    )
  }

  const sysConfig = systemNodeConfig(node.kind, t)
  return (
    <button
      onClick={() => onSeek(idx)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
        highlight ? "bg-primary/10" : "hover:bg-muted/30",
        !active && "opacity-30",
      )}
      data-event-index={idx}
    >
      <sysConfig.icon className={cn("h-3 w-3 shrink-0", sysConfig.color)} />
      <span className="flex-1 truncate text-[11px] text-muted-foreground">{sysConfig.label}</span>
    </button>
  )
}

function nodeEventIndex(node: AuditNode): number {
  if (node.type === "tool_call") return node.startIndex
  return node.eventIndex
}

function systemNodeConfig(kind: string, t: TFunction): { icon: typeof Bot; color: string; label: string } {
  switch (kind) {
    case "compaction": return { icon: Zap, color: "text-amber-500", label: t("replay.compaction") }
    case "sub_agent_start": return { icon: GitBranch, color: "text-blue-500", label: t("replay.subAgentStart") }
    case "sub_agent_end": return { icon: GitMerge, color: "text-success", label: t("replay.subAgentEnd") }
    case "error": return { icon: AlertCircle, color: "text-destructive", label: t("replay.error") }
    case "done": return { icon: CheckCircle, color: "text-muted-foreground", label: t("replay.done") }
    case "approval_required": return { icon: Shield, color: "text-warning", label: t("replay.pendingApproval") }
    default: return { icon: Bot, color: "text-muted-foreground", label: kind }
  }
}
