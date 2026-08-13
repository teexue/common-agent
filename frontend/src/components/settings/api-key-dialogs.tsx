import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2, TriangleAlert } from "lucide-react"
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
import { CopyButton } from "@/components/shared/copy-button"
import { ALL_SCOPES, scopeLabel } from "@/components/settings/api-key-scopes"
import {
  createAuthKey,
  deleteAuthKey,
  type AuthKeyInfo,
  type CreatedAuthKey,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (key: CreatedAuthKey) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<string[]>(["*"])
  const [expiresDays, setExpiresDays] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      if (scope === "*") return prev.includes("*") ? [] : ["*"]
      const next = prev.filter((s) => s !== "*")
      return next.includes(scope)
        ? next.filter((s) => s !== scope)
        : [...next, scope]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const days = Number(expiresDays)
      const created = await createAuthKey(
        name,
        scopes,
        Number.isFinite(days) && days > 0 ? Math.floor(days) : undefined
      )
      setName("")
      setScopes(["*"])
      setExpiresDays("")
      onOpenChange(false)
      onCreated(created)
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
          <DialogTitle>{t("settings.apiKeyAdd")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.apiKeyName")}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-lg font-mono text-sm"
              placeholder="default"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.apiKeyScopes")}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {["*", ...ALL_SCOPES].map((s) => {
                const active = scopes.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                    )}
                  >
                    {scopeLabel(t, s)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.apiKeyExpires")}
            </Label>
            <Input
              type="number"
              min={1}
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              className="h-9 rounded-lg text-sm"
              placeholder={t("settings.apiKeyExpiresPlaceholder")}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={saving || !name.trim() || scopes.length === 0}
            >
              {saving ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Shows the raw key exactly once after creation. */
export function CreatedKeyDialog({
  created,
  onClose,
}: {
  created: CreatedAuthKey | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!created} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.apiKeyCreatedTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground select-all">
            {created?.key}
          </code>
          {created && <CopyButton text={created.key} />}
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("settings.apiKeyCreatedHint")}
        </p>
        <DialogFooter>
          <Button size="sm" className="h-8 text-xs" onClick={onClose}>
            {t("settings.apiKeyDismiss")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteKeyDialog({
  target,
  onClose,
  onDone,
}: {
  target: AuthKeyInfo | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!target) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAuthKey(target.id)
      onClose()
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-destructive" />{" "}
            {t("settings.apiKeyDeleteTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("settings.apiKeyDeleteConfirm", { name: target?.name })}
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
