import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { useToast } from "@/components/ui/toast"
import { isComposingEvent } from "@/lib/keys"
import { readFiles, type AttachError } from "@/lib/attachments"
import type { FileAttachment } from "@/types/agent"

function useFileAttachments(visionEnabled: boolean) {
  const { t } = useTranslation()
  const toast = useToast()
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      e.target.value = ""
      if (files.length === 0) return
      void readFiles(files).then((result) => {
        for (const err of result.errors) toast.warning(attachErrorText(t, err))
        const ok = acceptedAttachments(result.ok, visionEnabled, t, toast)
        if (ok.length > 0) setAttachments((prev) => [...prev, ...ok])
      })
    },
    [t, toast, visionEnabled]
  )
  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  return {
    attachments,
    setAttachments,
    fileInputRef,
    handleFileSelect,
    removeAttachment,
  }
}

function acceptedAttachments(
  items: FileAttachment[],
  visionEnabled: boolean,
  t: TFunction,
  toast: { warning: (msg: string) => void }
): FileAttachment[] {
  if (visionEnabled) return items
  const kept: FileAttachment[] = []
  for (const item of items) {
    if (item.kind === "image") {
      toast.warning(t("conversation.attachNoVision", { name: item.name }))
      continue
    }
    kept.push(item)
  }
  return kept
}

function attachErrorText(t: TFunction, err: AttachError): string {
  if (err.code === "unsupported") {
    return t("conversation.attachUnsupported", { name: err.name })
  }
  if (err.code === "too_large") {
    return t("conversation.attachTooLarge", { name: err.name })
  }
  return t("conversation.attachReadFailed", { name: err.name })
}

interface UseInputBarOpts {
  onSend: (text: string, attachments: FileAttachment[]) => void
  onStop?: () => void
  onOptimize?: (text: string) => Promise<string>
  disabled: boolean
  isStreaming?: boolean
  visionEnabled?: boolean
  optimizing?: boolean
}

export function useInputBar({
  onSend,
  onStop,
  onOptimize,
  disabled,
  isStreaming,
  visionEnabled,
  optimizing,
}: UseInputBarOpts) {
  const [text, setText] = useState("")
  const files = useFileAttachments(!!visionEnabled)

  const handleOptimize = async () => {
    if (!text.trim() || !onOptimize || optimizing) return
    try {
      setText(await onOptimize(text.trim()))
    } catch {
      // error handled by caller
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if ((!trimmed && files.attachments.length === 0) || disabled) return
    onSend(trimmed, files.attachments)
    setText("")
    files.setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingEvent(e)) return
    if (e.key !== "Enter" || e.shiftKey) return
    e.preventDefault()
    if (isStreaming) onStop?.()
    else handleSend()
  }

  return {
    text,
    setText,
    attachments: files.attachments,
    fileInputRef: files.fileInputRef,
    handleFileSelect: files.handleFileSelect,
    removeAttachment: files.removeAttachment,
    handleOptimize,
    handleSend,
    handleKeyDown,
  }
}
