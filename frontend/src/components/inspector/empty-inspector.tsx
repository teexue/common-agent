import { MousePointerClick } from "lucide-react"

export function EmptyInspector() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <MousePointerClick className="h-5 w-5 opacity-60" />
      </div>
      <p className="font-heading text-sm text-foreground">选择查看详情</p>
      <p className="mt-1.5 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
        点击工作区中的工具调用或消息来查看详细信息
      </p>
      <kbd className="mt-4 rounded-lg border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        Esc 关闭面板
      </kbd>
    </div>
  )
}
