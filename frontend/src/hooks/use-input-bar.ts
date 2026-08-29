import { useCallback, useRef, useState } from "react"
import { isComposingEvent } from "@/lib/keys"
import type { ImageAttachment } from "@/components/conversation/input-bar"

function useImageAttachments() {
  const [images, setImages] = useState<ImageAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setImages((prev) => [
              ...prev,
              { dataUrl: reader.result as string, name: file.name },
            ])
          }
        }
        reader.readAsDataURL(file)
      }
      e.target.value = ""
    },
    []
  )
  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index))
  return { images, setImages, fileInputRef, handleFileSelect, removeImage }
}

interface UseInputBarOpts {
  onSend: (text: string, images: ImageAttachment[]) => void
  onStop?: () => void
  onOptimize?: (text: string) => Promise<string>
  disabled: boolean
  isStreaming?: boolean
  optimizing?: boolean
}

export function useInputBar({
  onSend,
  onStop,
  onOptimize,
  disabled,
  isStreaming,
  optimizing,
}: UseInputBarOpts) {
  const [text, setText] = useState("")
  const { images, setImages, fileInputRef, handleFileSelect, removeImage } =
    useImageAttachments()

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
    if ((!trimmed && images.length === 0) || disabled) return
    onSend(trimmed, images)
    setText("")
    setImages([])
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
    images,
    fileInputRef,
    handleFileSelect,
    removeImage,
    handleOptimize,
    handleSend,
    handleKeyDown,
  }
}
