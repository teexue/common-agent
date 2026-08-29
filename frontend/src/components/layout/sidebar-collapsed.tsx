import { useTranslation } from "react-i18next"
import {
  BookOpen,
  ChevronRight,
  Coins,
  KanbanSquare,
  Layers,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth"

export interface CollapsedSidebarProps {
  onToggle: () => void
  onOpenSettings: () => void
  onOpenManage?: () => void
  onOpenKanban?: () => void
  onOpenApiDocs?: () => void
  onOpenUsage?: () => void
  onOpenAdmin?: () => void
  onNewSession?: () => void
}

function CollapsedIconButton({
  tooltip,
  onClick,
  children,
}: {
  tooltip: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClick}
            className="rounded-lg"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function CollapsedNavItems({
  onOpenSettings,
  onOpenManage,
  onOpenKanban,
  onOpenApiDocs,
  onOpenUsage,
  onOpenAdmin,
}: Omit<CollapsedSidebarProps, "onToggle" | "onNewSession">) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  return (
    <>
      {onOpenManage && (
        <CollapsedIconButton
          tooltip={t("layout.manage")}
          onClick={onOpenManage}
        >
          <Layers className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      {onOpenKanban && (
        <CollapsedIconButton
          tooltip={t("layout.kanban")}
          onClick={onOpenKanban}
        >
          <KanbanSquare className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      {onOpenApiDocs && (
        <CollapsedIconButton
          tooltip={t("layout.apiDocs")}
          onClick={onOpenApiDocs}
        >
          <BookOpen className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      {onOpenUsage && (
        <CollapsedIconButton tooltip={t("layout.usage")} onClick={onOpenUsage}>
          <Coins className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      {isAdmin && onOpenAdmin && (
        <CollapsedIconButton tooltip={t("layout.admin")} onClick={onOpenAdmin}>
          <ShieldCheck className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      <CollapsedIconButton
        tooltip={t("common.settings")}
        onClick={onOpenSettings}
      >
        <Settings className="h-3.5 w-3.5" />
      </CollapsedIconButton>
    </>
  )
}

export function CollapsedSidebar({
  onToggle,
  onOpenSettings,
  onOpenManage,
  onOpenKanban,
  onOpenApiDocs,
  onOpenUsage,
  onOpenAdmin,
  onNewSession,
}: CollapsedSidebarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
      <CollapsedIconButton
        tooltip={t("layout.expandSidebar")}
        onClick={onToggle}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </CollapsedIconButton>
      <Separator className="my-2 w-6" />
      {onNewSession && (
        <CollapsedIconButton
          tooltip={t("layout.newSession")}
          onClick={onNewSession}
        >
          <Plus className="h-3.5 w-3.5" />
        </CollapsedIconButton>
      )}
      <div className="flex-1" />
      <CollapsedNavItems
        onOpenSettings={onOpenSettings}
        onOpenManage={onOpenManage}
        onOpenKanban={onOpenKanban}
        onOpenApiDocs={onOpenApiDocs}
        onOpenUsage={onOpenUsage}
        onOpenAdmin={onOpenAdmin}
      />
    </div>
  )
}
