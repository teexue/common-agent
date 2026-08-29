export function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
