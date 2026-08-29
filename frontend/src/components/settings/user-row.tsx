import { useTranslation } from "react-i18next"
import { KeyRound, Trash2, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { ListRow } from "@/components/shared/list-row"
import { RoleBadge, RoleSelect } from "./user-role"
import type { AdminUserInfo } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"

export function UserRow({
  user,
  isSelf,
  onRoleChange,
  onResetPassword,
  onDelete,
}: {
  user: AdminUserInfo
  isSelf: boolean
  onRoleChange: (role: string) => void
  onResetPassword: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <ListRow className="group flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <UserRound className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{user.username}</p>
          <RoleBadge role={user.role} />
          {isSelf && (
            <Badge
              variant="outline"
              className="rounded-md px-1.5 py-0 text-[10px]"
            >
              {t("settings.userCurrent")}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {user.name || user.username} · {formatRelativeTime(user.created_at)}
        </p>
      </div>
      <UserRowActions
        role={user.role}
        onRoleChange={onRoleChange}
        onResetPassword={onResetPassword}
        onDelete={onDelete}
      />
    </ListRow>
  )
}

function UserRowActions({
  role,
  onRoleChange,
  onResetPassword,
  onDelete,
}: {
  role: string
  onRoleChange: (role: string) => void
  onResetPassword: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
      <RoleSelect value={role} onChange={onRoleChange} />
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-7 w-7 rounded-lg text-muted-foreground"
        onClick={onResetPassword}
        title={t("settings.userResetPassword")}
      >
        <KeyRound className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        title={t("common.delete")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function RegistrationRow({
  allow,
  onToggle,
}: {
  allow: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <ListRow className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-foreground">
          {t("settings.registration")}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
          {t("settings.registrationHint")}
        </span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${allow ? "bg-primary" : "bg-muted-foreground/30"}`}
        title={t("settings.registration")}
      >
        <span
          className={`h-3 w-3 rounded-full bg-background transition-transform ${allow ? "translate-x-3" : ""}`}
        />
      </button>
    </ListRow>
  )
}

export function UsersEmpty({ count }: { count: number }) {
  const { t } = useTranslation()
  if (count > 0) return null
  return <EmptyState title={t("settings.userEmpty")} />
}
