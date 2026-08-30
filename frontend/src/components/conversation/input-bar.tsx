import { useTranslation } from "react-i18next"
import { Textarea } from "@/components/ui/textarea"
import { useInputBar } from "@/hooks/use-input-bar"
import { AttachImageButton, InputBarFooterRight } from "./input-bar-actions"
import { InputBarImages } from "./input-bar-images"
import {
  TokenUsageIndicator,
  type SessionTokenUsage,
} from "./token-usage-indicator"

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
  accessory?: React.ReactNode
  tokenUsage?: SessionTokenUsage
}

export function InputBar(props: InputBarProps) {
  const {
    text,
    setText,
    images,
    fileInputRef,
    handleFileSelect,
    removeImage,
    handleOptimize,
    handleSend,
    handleKeyDown,
  } = useInputBar(props)
  return (
    <div className="shrink-0 px-5 pt-2 pb-5">
      <InputBarImages images={images} onRemove={removeImage} />
      <div className="relative rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md">
        <PromptField
          text={text}
          onChange={setText}
          onKeyDown={handleKeyDown}
          isStreaming={!!props.isStreaming}
        />
        <InputBarToolbar
          accessory={props.accessory}
          tokenUsage={props.tokenUsage}
          isStreaming={!!props.isStreaming}
          visionEnabled={props.visionEnabled}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          showOptimize={!!props.onOptimize}
          optimizing={props.optimizing}
          optimizeDisabled={
            props.disabled || !text.trim() || !!props.optimizing
          }
          sendDisabled={props.disabled || (!text.trim() && images.length === 0)}
          onOptimizeClick={handleOptimize}
          onSend={handleSend}
          onStop={props.onStop}
        />
      </div>
    </div>
  )
}

function PromptField({
  text,
  onChange,
  onKeyDown,
  isStreaming,
}: {
  text: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isStreaming: boolean
}) {
  const { t } = useTranslation()
  return (
    <Textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={
        isStreaming
          ? t("conversation.placeholderStreaming")
          : t("conversation.placeholderIdle")
      }
      disabled={false}
      className="max-h-[calc(6lh+1rem)] min-h-[calc(1lh+1rem)] resize-none overflow-y-auto overscroll-contain border-0 bg-transparent px-3.5 pt-3 pb-1 text-sm shadow-none focus-visible:ring-0"
      rows={1}
    />
  )
}

function InputBarToolbar({
  accessory,
  tokenUsage,
  isStreaming,
  visionEnabled,
  fileInputRef,
  onFileSelect,
  showOptimize,
  optimizing,
  optimizeDisabled,
  sendDisabled,
  onOptimizeClick,
  onSend,
  onStop,
}: {
  accessory?: React.ReactNode
  tokenUsage?: SessionTokenUsage
  isStreaming: boolean
  visionEnabled?: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  showOptimize: boolean
  optimizing?: boolean
  optimizeDisabled: boolean
  sendDisabled: boolean
  onOptimizeClick: () => void
  onSend: () => void
  onStop?: () => void
}) {
  return (
    <div className="flex flex-nowrap items-center gap-2 px-2 pb-2">
      <ToolbarStart
        accessory={accessory}
        visionEnabled={visionEnabled}
        fileInputRef={fileInputRef}
        onFileSelect={onFileSelect}
      />
      {tokenUsage ? (
        <div className="shrink-0">
          <TokenUsageIndicator usage={tokenUsage} />
        </div>
      ) : null}
      <InputBarFooterRight
        isStreaming={isStreaming}
        showOptimize={showOptimize}
        optimizing={optimizing}
        optimizeDisabled={optimizeDisabled}
        sendDisabled={sendDisabled}
        onOptimizeClick={onOptimizeClick}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  )
}

function ToolbarStart({
  accessory,
  visionEnabled,
  fileInputRef,
  onFileSelect,
}: {
  accessory?: React.ReactNode
  visionEnabled?: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
      {accessory}
      {visionEnabled && (
        <AttachImageButton onClick={() => fileInputRef.current?.click()} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />
    </div>
  )
}
