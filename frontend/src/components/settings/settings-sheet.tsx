import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot } from "lucide-react"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: string
  onThemeChange: (theme: string) => void
}

export function SettingsSheet({
  open,
  onOpenChange,
  theme,
  onThemeChange,
}: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-card">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-heading text-sm tracking-tight">
            <Bot className="h-4 w-4 text-primary" />
            设置
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              主题
            </Label>
            <Select
              value={theme}
              onValueChange={(value) => {
                if (value) onThemeChange(value)
              }}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="light">亮色</SelectItem>
                <SelectItem value="dark">暗色</SelectItem>
                <SelectItem value="system">跟随系统</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              关于
            </Label>
            <div className="rounded-xl border border-border bg-muted/50 p-3">
              <p className="font-mono text-xs text-foreground">
                common-agent v0.0.1
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                通用 Agent 运行时前端
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              快捷键
            </Label>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {[
                ["切换侧边栏", "⌘ Shift S"],
                ["关闭面板", "Esc"],
                ["发送消息", "Enter"],
                ["换行", "Shift Enter"],
              ].map(([label, key]) => (
                <div key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <kbd className="rounded-lg border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
