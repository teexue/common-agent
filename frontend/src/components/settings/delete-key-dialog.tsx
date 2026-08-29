import { useState } from "react"
import { useTranslation } from "react-i18next"
import { deleteAuthKey, type AuthKeyInfo } from "@/lib/api"
import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { errMessage } from "./select-value"

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
      setError(errMessage(err))
    } finally {
      setDeleting(false)
    }
  }
  return (
    <ConfirmDeleteDialog
      open={!!target}
      title={t("settings.apiKeyDeleteTitle")}
      message={t("settings.apiKeyDeleteConfirm", { name: target?.name })}
      error={error}
      deleting={deleting}
      onClose={onClose}
      onConfirm={() => void handleDelete()}
    />
  )
}
