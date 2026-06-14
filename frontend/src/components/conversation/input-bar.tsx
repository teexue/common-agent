import { useState } from "react"
import { CornerDownLeft, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface InputBarProps {
  onSend: (text: string) => void
  onStop?: () => void
  disabled: boolean
  isStreaming?: boolean
}

export function InputBar({ onSend, onStop, disabled, isStreaming }: InputBarProps) {
  const [text, setText] = useState("")

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) {
        onStop?.()
      } else {
        handleSend()
      }
    }
  }

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      <div className="relative rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "生成中... 按 Enter 停止" : "输入指令..."}
          disabled={false}
          className="min-h-[2.75rem] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
          rows={1}
        />
        <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
          <span className="text-[10px] text-muted-foreground/60">
            {isStreaming ? (
              <>
                <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px]">Enter</kbd>
                {" "}停止生成
              </>
            ) : (
              <>
                <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px]">Enter</kbd>
                {" "}发送 · {" "}
                <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px]">Shift+Enter</kbd>
                {" "}换行
              </>
            )}
          </span>
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1.5 rounded-lg px-3 text-xs"
                    onClick={onStop}
                  >
                    <Square className="h-3 w-3" />
                    停止
                  </Button>
                }
              >
              </TooltipTrigger>
              <TooltipContent>停止生成</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 rounded-lg px-3 text-xs disabled:opacity-30"
                    onClick={handleSend}
                    disabled={disabled || !text.trim()}
                  >
                    发送
                    <CornerDownLeft className="h-3 w-3 opacity-60" />
                  </Button>
                }
              >
              </TooltipTrigger>
              <TooltipContent>发送消息</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
