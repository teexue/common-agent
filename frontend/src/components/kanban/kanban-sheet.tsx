import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function KanbanSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card px-6 py-7 shadow-sm ring-1 ring-border/50 sm:px-9 sm:py-8",
        className
      )}
    >
      {children}
    </div>
  )
}

export function KanbanEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}
