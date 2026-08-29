import { useState } from "react"
import { useTranslation } from "react-i18next"
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
import { updateAdminUser, type AdminUserInfo } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import { errMessage } from "./select-value"

function useResetPasswordForm(opts: {
  user: AdminUserInfo
  onClose: () => void
  onDone: () => void
  onError: (msg: string) => void
}) {
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateAdminUser(opts.user.id, { password })
      setPassword("")
      opts.onClose()
      opts.onDone()
    } catch (err: unknown) {
      const msg = errMessage(err)
      setError(msg)
      opts.onError(msg)
    } finally {
      setSaving(false)
    }
  }
  return { password, setPassword, saving, error, handleSubmit }
}

function ResetPasswordForm({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUserInfo
  onClose: () => void
  onDone: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const form = useResetPasswordForm({ user, onClose, onDone, onError })
  return (
    <form
      onSubmit={form.handleSubmit}
      onKeyDown={(e) => {
        // Don't submit while confirming an IME candidate with Enter.
        if (isComposingEvent(e)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.userNewPassword")}
        </Label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => form.setPassword(e.target.value)}
          className="h-9 rounded-lg text-sm"
          autoComplete="new-password"
          placeholder={t("settings.userPasswordHint")}
          autoFocus
        />
      </div>
      {form.error && <p className="text-xs text-destructive">{form.error}</p>}
      <DialogFooter>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs"
          disabled={form.saving || form.password.length < 6}
        >
          {form.saving ? t("common.loading") : t("common.save")}
        </Button>
      </DialogFooter>
    </form>
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
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("settings.userResetPasswordTitle", { name: user?.username })}
          </DialogTitle>
        </DialogHeader>
        {user && (
          <ResetPasswordForm
            user={user}
            onClose={onClose}
            onDone={onDone}
            onError={onError}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
