import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CornerDownLeft, ImagePlus, Loader2, Sparkles, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface ImageAttachment {
  dataUrl: string
  name: string
}

interface InputBarProps {
  onSend: (text: string, images: ImageAttachment[]) => void
  onStop?: () => void
  onOptimize?: (text: string) => Promise<string>
  disabled: boolean
  isStreaming?: boolean
  visionEnabled?: boolean
  optimizing?: boolean
}

function HintText({ isStreaming }: { isStreaming: boolean }) {
  const { t } = useTranslation()
  return (
    <span className="text-[11px] text-muted-foreground/70">
      {isStreaming ? (
        <><kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">Enter</kbd> {t("conversation.hintStop")}</>
      ) : (
        <><kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">Enter</kbd> {t("conversation.hintSend")} <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">Shift+Enter</kbd> {t("conversation.hintNewline")}</>
      )}
    </span>
  )
}

export function InputBar({ onSend, onStop, onOptimize, disabled, isStreaming, visionEnabled, optimizing }: InputBarProps) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [images, setImages] = useState<ImageAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOptimize = async () => {
    if (!text.trim() || !onOptimize || optimizing) return
    try {
      const result = await onOptimize(text.trim())
      setText(result)
    } catch {
      // error handled by caller
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if ((!trimmed && images.length === 0) || disabled) return
    onSend(trimmed, images); setText(""); setImages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      isStreaming ? onStop?.() : handleSend()
    }
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setImages((prev) => [...prev, { dataUrl: reader.result as string, name: file.name }])
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ""
  }, [])

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index))

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      {images.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border">
              <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
              <button onClick={() => removeImage(i)} className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={isStreaming ? t("conversation.placeholderStreaming") : t("conversation.placeholderIdle")} disabled={false}
          className="min-h-[2.75rem] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0" rows={1} />
        <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
          <div className="flex items-center gap-1">
            <HintText isStreaming={!!isStreaming} />
            {visionEnabled && (
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-xs" className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()}><ImagePlus className="h-3.5 w-3.5" /></Button>} />
                <TooltipContent>{t("conversation.attachImage", "添加图片")}</TooltipContent>
              </Tooltip>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
          </div>
          <div className="flex items-center gap-1">
            {!isStreaming && onOptimize && (
              <Tooltip>
                <TooltipTrigger render={<Button size="sm" variant="ghost" className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={handleOptimize} disabled={disabled || !text.trim() || optimizing}>{optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {optimizing ? t("conversation.optimizing") : t("conversation.optimizePrompt")}</Button>} />
                <TooltipContent>{t("conversation.optimizePrompt")}</TooltipContent>
              </Tooltip>
            )}
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger render={<Button size="sm" variant="destructive" className="h-7 gap-1.5 rounded-lg px-3 text-xs" onClick={onStop}><Square className="h-3 w-3" /> {t("conversation.stop")}</Button>} />
                <TooltipContent>{t("conversation.stopGenerating")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger render={<Button size="sm" className="h-7 gap-1.5 rounded-lg px-3 text-xs disabled:opacity-30" onClick={handleSend} disabled={disabled || (!text.trim() && images.length === 0)}>{t("conversation.send")} <CornerDownLeft className="h-3 w-3 opacity-60" /></Button>} />
                <TooltipContent>{t("conversation.sendMessage")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
