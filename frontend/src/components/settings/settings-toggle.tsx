import { cn } from "@/lib/utils"

export function SettingsToggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/25"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  )
}
