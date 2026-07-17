import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { TurnNode } from "@/types/replay"
import { AuditTreeNode } from "./audit-tree-node"

interface AuditTreePanelProps {
  turnNodes: TurnNode[]
  currentIndex: number
  onSeek: (index: number) => void
}

export function AuditTreePanel({ turnNodes, currentIndex, onSeek }: AuditTreePanelProps) {
  const { t } = useTranslation()
  if (turnNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {t("replay.noAudit")}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {turnNodes.map((turnNode) => (
          <AuditTreeNode
            key={turnNode.turn}
            turnNode={turnNode}
            currentIndex={currentIndex}
            onSeek={onSeek}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
