import { cn } from "@/lib/utils"

interface ListRowProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

/** Standard list row card with the shared hover treatment. */
export function ListRow({ onClick, children, className }: ListRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20 hover:bg-muted/30",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}
