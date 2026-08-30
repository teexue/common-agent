import { Label } from "@/components/ui/label"

export function SettingsField({
  label,
  hint,
  hintClassName = "text-[11px] leading-relaxed text-muted-foreground",
  children,
}: {
  label: React.ReactNode
  hint?: string
  hintClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint ? <p className={hintClassName}>{hint}</p> : null}
    </div>
  )
}

export function SettingsRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4">
      <p className="min-w-0 flex-1 text-sm text-foreground">{label}</p>
      <div className="w-full shrink-0 sm:w-48">{children}</div>
    </div>
  )
}
