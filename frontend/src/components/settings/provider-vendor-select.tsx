import { useTranslation } from "react-i18next"
import type { VendorInfo } from "@/types/agent"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"

export function VendorSelect({
  vendors,
  vendorName,
  onApply,
}: {
  vendors: VendorInfo[]
  vendorName: string
  onApply: (v: VendorInfo) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerVendor")}>
      <SettingsSelect
        value={vendorName}
        options={vendors.map((v) => ({
          value: v.name,
          label: v.display_name,
        }))}
        placeholder={t("settings.providerVendorPlaceholder")}
        onChange={(name) => {
          const found = vendors.find((x) => x.name === name)
          if (found) onApply(found)
        }}
      />
    </SettingsField>
  )
}
