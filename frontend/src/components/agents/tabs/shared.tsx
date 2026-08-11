import { Label } from "@/components/ui/label"

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium text-foreground">{label}</Label>
      {children}
      {hint && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
