import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Standard empty state: dashed frame with centered muted content. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center",
        className
      )}
    >
      {Icon && <Icon className="h-5 w-5 text-muted-foreground/60" />}
      <p className="text-xs text-muted-foreground">{title}</p>
      {description && (
        <p className="text-[11px] text-muted-foreground/70">{description}</p>
      )}
      {action}
    </div>
  )
}
