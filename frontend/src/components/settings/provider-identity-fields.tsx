import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import type { VendorInfo } from "@/types/agent"
import { SettingsField } from "./settings-field"
import { SettingsSelect } from "./settings-select"
import type { StyleOption } from "./provider-form-utils"

function NameField({
  isEdit,
  name,
  onNameChange,
}: {
  isEdit: boolean
  name: string
  onNameChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerName")}>
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        disabled={isEdit}
        className="h-9 rounded-lg font-mono text-sm"
        placeholder="moonshot"
      />
    </SettingsField>
  )
}

function DisplayNameField({
  displayName,
  onDisplayNameChange,
  placeholder,
}: {
  displayName: string
  onDisplayNameChange: (v: string) => void
  placeholder: string
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerDisplayName")}>
      <Input
        value={displayName}
        onChange={(e) => onDisplayNameChange(e.target.value)}
        className="h-9 rounded-lg text-sm"
        placeholder={placeholder}
      />
    </SettingsField>
  )
}

function StyleField({
  apiStyle,
  styleOptions,
  onStyleChange,
}: {
  apiStyle: StyleOption
  styleOptions: StyleOption[]
  onStyleChange: (style: StyleOption) => void
}) {
  const { t } = useTranslation()
  return (
    <SettingsField label={t("settings.providerAPIStyle")}>
      <SettingsSelect
        value={apiStyle}
        options={styleOptions.map((s) => ({ value: s, label: s }))}
        onChange={(v) => onStyleChange(v as StyleOption)}
      />
    </SettingsField>
  )
}

export function IdentityFields({
  isEdit,
  name,
  onNameChange,
  displayName,
  onDisplayNameChange,
  selectedVendor,
  apiStyle,
  styleOptions,
  onStyleChange,
}: {
  isEdit: boolean
  name: string
  onNameChange: (v: string) => void
  displayName: string
  onDisplayNameChange: (v: string) => void
  selectedVendor: VendorInfo | null
  apiStyle: StyleOption
  styleOptions: StyleOption[]
  onStyleChange: (style: StyleOption) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <NameField isEdit={isEdit} name={name} onNameChange={onNameChange} />
      <DisplayNameField
        displayName={displayName}
        onDisplayNameChange={onDisplayNameChange}
        placeholder={selectedVendor?.display_name ?? name ?? "My Provider"}
      />
      <StyleField
        apiStyle={apiStyle}
        styleOptions={styleOptions}
        onStyleChange={onStyleChange}
      />
    </div>
  )
}
