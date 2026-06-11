import type { StreamStatus } from "@/types/agent"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  StreamStatus,
  { dot: string; label: string; className?: string }
> = {
  idle: {
    dot: "bg-muted-foreground/30",
    label: "空闲",
  },
  streaming: {
    dot: "bg-primary",
    label: "运行中",
    className: "animate-pulse",
  },
  error: {
    dot: "bg-destructive",
    label: "错误",
  },
  done: {
    dot: "bg-success",
    label: "完成",
  },
}

export function StatusIndicator({ status }: { status: StreamStatus }) {
  const config = statusConfig[status]
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          config.dot,
          config.className
        )}
      />
      <span className="text-[10px] font-medium text-muted-foreground">
        {config.label}
      </span>
    </div>
  )
}
