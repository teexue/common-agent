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
import { ALL_SCOPES, scopeLabel } from "./api-key-scopes"
import { createAuthKey, type CreatedAuthKey } from "@/lib/api"
import { isComposingEvent } from "@/lib/keys"
import { cn } from "@/lib/utils"
import { errMessage } from "./select-value"

function ScopePicker({
  scopes,
  onToggle,
}: {
  scopes: string[]
  onToggle: (scope: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1.5">
      {["*", ...ALL_SCOPES].map((s) => {
        const active = scopes.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
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
  )
}

function toggleScope(prev: string[], scope: string): string[] {
  if (scope === "*") return prev.includes("*") ? [] : ["*"]
  const next = prev.filter((s) => s !== "*")
  return next.includes(scope)
    ? next.filter((s) => s !== scope)
    : [...next, scope]
}

function useCreateKeyForm(
  onCreated: (key: CreatedAuthKey) => void,
  onOpenChange: (open: boolean) => void
) {
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<string[]>(["*"])
  const [expiresDays, setExpiresDays] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError(errMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return {
    name,
    setName,
    scopes,
    setScopes,
    expiresDays,
    setExpiresDays,
    saving,
    error,
    handleSubmit,
  }
}

function CreateKeyFields({
  form,
}: {
  form: ReturnType<typeof useCreateKeyForm>
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.apiKeyName")}
        </Label>
        <Input
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          className="h-9 rounded-lg font-mono text-sm"
          placeholder="default"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.apiKeyScopes")}
        </Label>
        <ScopePicker
          scopes={form.scopes}
          onToggle={(s) => form.setScopes((prev) => toggleScope(prev, s))}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("settings.apiKeyExpires")}
        </Label>
        <Input
          type="number"
          min={1}
          value={form.expiresDays}
          onChange={(e) => form.setExpiresDays(e.target.value)}
          className="h-9 rounded-lg text-sm"
          placeholder={t("settings.apiKeyExpiresPlaceholder")}
        />
      </div>
    </>
  )
}

function CreateKeyForm({
  form,
}: {
  form: ReturnType<typeof useCreateKeyForm>
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
      <CreateKeyFields form={form} />
      {form.error && <p className="text-xs text-destructive">{form.error}</p>}
      <DialogFooter>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs"
          disabled={
            form.saving || !form.name.trim() || form.scopes.length === 0
          }
        >
          {form.saving ? t("common.loading") : t("common.create")}
        </Button>
      </DialogFooter>
    </form>
  )
}

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
  const form = useCreateKeyForm(onCreated, onOpenChange)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.apiKeyAdd")}</DialogTitle>
        </DialogHeader>
        <CreateKeyForm form={form} />
      </DialogContent>
    </Dialog>
  )
}
