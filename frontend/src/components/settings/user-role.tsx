import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Role badge: admin uses the primary tone, member the secondary tone. */
export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant={role === "admin" ? "default" : "secondary"}
      className="rounded-md px-1.5 py-0 text-[10px]"
    >
      {role === "admin" ? t("settings.roleAdmin") : t("settings.roleMember")}
    </Badge>
  )
}

/** Compact admin/member role picker. */
export function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (role: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger size="sm" className="h-7 text-xs" disabled={disabled}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value="admin">{t("settings.roleAdmin")}</SelectItem>
        <SelectItem value="member">{t("settings.roleMember")}</SelectItem>
      </SelectContent>
    </Select>
  )
}
