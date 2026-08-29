import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import {
  BookOpen,
  Coins,
  KanbanSquare,
  Layers,
  LogOut,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth"

interface SidebarFooterProps {
  onOpenSettings: () => void
  onOpenManage?: () => void
  onOpenKanban?: () => void
  onOpenApiDocs?: () => void
  onOpenUsage?: () => void
  onOpenAdmin?: () => void
}

function SidebarNavButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  )
}

function WorkspaceNav({
  onOpenKanban,
  onOpenApiDocs,
  onOpenUsage,
}: Pick<SidebarFooterProps, "onOpenKanban" | "onOpenApiDocs" | "onOpenUsage">) {
  const { t } = useTranslation()
  return (
    <>
      {onOpenKanban && (
        <SidebarNavButton
          icon={KanbanSquare}
          label={t("layout.kanban")}
          onClick={onOpenKanban}
        />
      )}
      {onOpenApiDocs && (
        <SidebarNavButton
          icon={BookOpen}
          label={t("layout.apiDocs")}
          onClick={onOpenApiDocs}
        />
      )}
      {onOpenUsage && (
        <SidebarNavButton
          icon={Coins}
          label={t("layout.usage")}
          onClick={onOpenUsage}
        />
      )}
    </>
  )
}

function SystemNav({
  onOpenManage,
  onOpenSettings,
  onOpenAdmin,
}: Pick<
  SidebarFooterProps,
  "onOpenManage" | "onOpenSettings" | "onOpenAdmin"
>) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  return (
    <>
      {onOpenManage && (
        <SidebarNavButton
          icon={Layers}
          label={t("layout.manage")}
          onClick={onOpenManage}
        />
      )}
      <SidebarNavButton
        icon={Settings}
        label={t("common.settings")}
        onClick={onOpenSettings}
      />
      {isAdmin && onOpenAdmin && (
        <SidebarNavButton
          icon={ShieldCheck}
          label={t("layout.admin")}
          onClick={onOpenAdmin}
        />
      )}
    </>
  )
}

export function SidebarFooter(props: SidebarFooterProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  return (
    <div className="flex flex-col gap-0.5 border-t border-border/60 p-2.5">
      {user && (
        <div
          className="mb-1 truncate px-2 text-[10px] text-muted-foreground"
          title={`@${user.username}`}
        >
          {user.name || user.username}
        </div>
      )}
      <WorkspaceNav
        onOpenKanban={props.onOpenKanban}
        onOpenApiDocs={props.onOpenApiDocs}
        onOpenUsage={props.onOpenUsage}
      />
      <Separator className="my-1.5" />
      <SystemNav
        onOpenManage={props.onOpenManage}
        onOpenSettings={props.onOpenSettings}
        onOpenAdmin={props.onOpenAdmin}
      />
      <Separator className="my-1.5" />
      <SidebarNavButton
        icon={LogOut}
        label={t("auth.logout")}
        onClick={() => {
          logout()
          navigate("/login", { replace: true })
        }}
      />
    </div>
  )
}
