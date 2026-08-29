import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { CreateUserDialog } from "./create-user-dialog"
import { DeleteUserDialog } from "./delete-user-dialog"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { RegistrationRow, UserRow, UsersEmpty } from "./user-row"
import { useAuth } from "@/lib/auth"
import {
  fetchAdminUsers,
  fetchRegistrationSetting,
  updateAdminUser,
  updateRegistrationSetting,
  type AdminUserInfo,
} from "@/lib/api"
import { FormError } from "./form-error"
import { errMessage } from "./select-value"

function useUsersPanel() {
  const { user: me, refresh: refreshAuth } = useAuth()
  const [users, setUsers] = useState<AdminUserInfo[]>([])
  const [allowRegistration, setAllowRegistration] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<AdminUserInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserInfo | null>(null)
  const refresh = useCallback(() => {
    Promise.all([fetchAdminUsers(), fetchRegistrationSetting()])
      .then(([list, reg]) => {
        setUsers(list)
        setAllowRegistration(!!reg.allow_registration)
        setError(null)
      })
      .catch((e: unknown) => {
        setUsers([])
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return {
    me,
    refreshAuth,
    users,
    allowRegistration,
    setAllowRegistration,
    loading,
    error,
    setError,
    createOpen,
    setCreateOpen,
    resetTarget,
    setResetTarget,
    deleteTarget,
    setDeleteTarget,
    refresh,
  }
}

function UsersToolbar({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {t("settings.users")}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5" /> {t("settings.userAdd")}
      </Button>
    </div>
  )
}

function UsersDialogs(p: ReturnType<typeof useUsersPanel>) {
  return (
    <>
      <CreateUserDialog
        open={p.createOpen}
        onOpenChange={p.setCreateOpen}
        onCreated={p.refresh}
      />
      <ResetPasswordDialog
        user={p.resetTarget}
        onClose={() => p.setResetTarget(null)}
        onDone={p.refresh}
        onError={p.setError}
      />
      <DeleteUserDialog
        user={p.deleteTarget}
        onClose={() => p.setDeleteTarget(null)}
        onDone={() => {
          p.refresh()
          void p.refreshAuth()
        }}
      />
    </>
  )
}

function useUserActions(p: ReturnType<typeof useUsersPanel>) {
  const handleRoleChange = async (u: AdminUserInfo, role: string) => {
    p.setError(null)
    try {
      await updateAdminUser(u.id, { role })
      p.refresh()
      if (u.id === p.me?.id) void p.refreshAuth()
    } catch (e: unknown) {
      p.setError(errMessage(e))
    }
  }
  const handleToggleRegistration = async () => {
    p.setError(null)
    try {
      await updateRegistrationSetting(!p.allowRegistration)
      p.setAllowRegistration(!p.allowRegistration)
      void p.refreshAuth()
    } catch (e: unknown) {
      p.setError(errMessage(e))
    }
  }
  return { handleRoleChange, handleToggleRegistration }
}

/** Admin user management: list, create, role/password edits, registration toggle. */
export function UsersPanel() {
  const { t } = useTranslation()
  const p = useUsersPanel()
  const actions = useUserActions(p)
  if (p.loading) return <EmptyState title={t("common.loading")} />
  return (
    <div className="space-y-3">
      <FormError error={p.error} />
      <RegistrationRow
        allow={p.allowRegistration}
        onToggle={() => void actions.handleToggleRegistration()}
      />
      <UsersToolbar onAdd={() => p.setCreateOpen(true)} />
      <UsersEmpty count={p.users.length} />
      {p.users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          isSelf={u.id === p.me?.id}
          onRoleChange={(role) => void actions.handleRoleChange(u, role)}
          onResetPassword={() => p.setResetTarget(u)}
          onDelete={() => p.setDeleteTarget(u)}
        />
      ))}
      <UsersDialogs {...p} />
    </div>
  )
}
