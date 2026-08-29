import { Label } from "@/components/ui/label"

export function SettingsField({
  label,
  hint,
  hintClassName = "text-[10px] text-muted-foreground",
  children,
}: {
  label: React.ReactNode
  hint?: string
  hintClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className={hintClassName}>{hint}</p> : null}
    </div>
  )
}
