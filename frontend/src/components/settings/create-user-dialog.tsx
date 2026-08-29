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
import { RoleSelect } from "./user-role"
import { createAdminUser } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import { errMessage } from "./select-value"

function CreateUserCredentials({
  username,
  password,
  onUsername,
  onPassword,
}: {
  username: string
  password: string
  onUsername: (v: string) => void
  onPassword: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("auth.username")}
        </Label>
        <Input
          value={username}
          onChange={(e) => onUsername(e.target.value)}
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
          onChange={(e) => onPassword(e.target.value)}
          className="h-9 rounded-lg text-sm"
          autoComplete="new-password"
          placeholder={t("settings.userPasswordHint")}
        />
      </div>
    </>
  )
}

function CreateUserProfile({
  name,
  role,
  onName,
  onRole,
}: {
  name: string
  role: string
  onName: (v: string) => void
  onRole: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("auth.displayName")}
        </Label>
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          className="h-9 rounded-lg text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.userRole")}
        </Label>
        <RoleSelect value={role} onChange={onRole} />
      </div>
    </>
  )
}

function useCreateUserForm(
  onCreated: () => void,
  onOpenChange: (open: boolean) => void
) {
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
      setError(errMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return {
    username,
    setUsername,
    password,
    setPassword,
    name,
    setName,
    role,
    setRole,
    saving,
    error,
    handleSubmit,
  }
}

function CreateUserForm({
  form,
}: {
  form: ReturnType<typeof useCreateUserForm>
}) {
  const { t } = useTranslation()
  return (
    <form
      onSubmit={form.handleSubmit}
      onKeyDown={(e) => {
        // Don't submit while confirming an IME candidate with Enter.
        if (isComposingEvent(e)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <CreateUserCredentials
        username={form.username}
        password={form.password}
        onUsername={form.setUsername}
        onPassword={form.setPassword}
      />
      <CreateUserProfile
        name={form.name}
        role={form.role}
        onName={form.setName}
        onRole={form.setRole}
      />
      {form.error && <p className="text-xs text-destructive">{form.error}</p>}
      <DialogFooter>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs"
          disabled={
            form.saving || !form.username.trim() || form.password.length < 6
          }
        >
          {form.saving ? t("common.loading") : t("common.create")}
        </Button>
      </DialogFooter>
    </form>
  )
}

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
  const form = useCreateUserForm(onCreated, onOpenChange)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.userCreateTitle")}</DialogTitle>
        </DialogHeader>
        <CreateUserForm form={form} />
      </DialogContent>
    </Dialog>
  )
}
