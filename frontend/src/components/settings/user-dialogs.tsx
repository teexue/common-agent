import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleSelect } from "@/components/settings/user-role"
import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUser,
  type AdminUserInfo,
} from "@/lib/api"

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setUsername("")
    setPassword("")
    setName("")
    setRole("member")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAdminUser({
        username,
        password,
        name: name || undefined,
        role,
      })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.userCreateTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("auth.username")}
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 rounded-lg font-mono text-sm"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("auth.password")}
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded-lg text-sm"
              autoComplete="new-password"
              placeholder={t("settings.userPasswordHint")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("auth.displayName")}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.userRole")}
            </Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={saving || !username.trim() || password.length < 6}
            >
              {saving ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ResetPasswordDialog({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUserInfo | null
  onClose: () => void
  onDone: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await updateAdminUser(user.id, { password })
      setPassword("")
      onClose()
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("settings.userResetPasswordTitle", { name: user?.username })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.userNewPassword")}
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded-lg text-sm"
              autoComplete="new-password"
              placeholder={t("settings.userPasswordHint")}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={saving || password.length < 6}
            >
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserInfo | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!user) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAdminUser(user.id)
      onClose()
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-destructive" />{" "}
            {t("settings.userDeleteTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("settings.userDeleteConfirm", { name: user?.username })}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onClose}
            disabled={deleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? t("common.loading") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
