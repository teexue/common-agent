import { useState } from "react"
import { useTranslation } from "react-i18next"
import { deleteAdminUser, type AdminUserInfo } from "@/lib/api"
import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { errMessage } from "./select-value"

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
      setError(errMessage(err))
    } finally {
      setDeleting(false)
    }
  }
  return (
    <ConfirmDeleteDialog
      open={!!user}
      title={t("settings.userDeleteTitle")}
      message={t("settings.userDeleteConfirm", { name: user?.username })}
      error={error}
      deleting={deleting}
      onClose={onClose}
      onConfirm={() => void handleDelete()}
    />
  )
}
