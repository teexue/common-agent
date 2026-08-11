import { ArrowLeft, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  onBack?: () => void
  actions?: React.ReactNode
}

/** Standard page header: optional back button, icon + title, right-side actions. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  onBack,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-6 py-4">
      {onBack && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <div>
          <h1 className="font-heading text-base tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-2">{actions}</div>
        </>
      )}
    </header>
  )
}
