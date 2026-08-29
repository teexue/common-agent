import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { selectString } from "./select-value"

export interface SelectOption {
  value: string
  label: string
}

export function SettingsSelect({
  value,
  options,
  onChange,
  placeholder,
  triggerClassName = "h-9 w-full rounded-lg text-sm",
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  triggerClassName?: string
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <Select
      value={value ? { value, label: selected?.label ?? value } : null}
      onValueChange={(v) => {
        const next = selectString(v)
        if (next !== undefined) onChange(next)
      }}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((o) => (
          <SelectItem key={o.value} value={{ value: o.value, label: o.label }}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
