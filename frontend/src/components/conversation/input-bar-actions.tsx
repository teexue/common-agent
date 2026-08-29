import { useTranslation } from "react-i18next"
import {
  CornerDownLeft,
  ImagePlus,
  Loader2,
  Sparkles,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  TokenUsageIndicator,
  type SessionTokenUsage,
} from "./token-usage-indicator"

export function HintText({ isStreaming }: { isStreaming: boolean }) {
  const { t } = useTranslation()
  return (
    <span className="text-[11px] text-muted-foreground/70">
      {isStreaming ? (
        <>
          <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">
            Enter
          </kbd>{" "}
          {t("conversation.hintStop")}
        </>
      ) : (
        <>
          <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">
            Enter
          </kbd>{" "}
          {t("conversation.hintSend")}{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px]">
            Shift+Enter
          </kbd>{" "}
          {t("conversation.hintNewline")}
        </>
      )}
    </span>
  )
}

export function AttachImageButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClick}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <TooltipContent>
        {t("conversation.attachImage", "添加图片")}
      </TooltipContent>
    </Tooltip>
  )
}

export function OptimizeButton({
  onClick,
  disabled,
  optimizing,
}: {
  onClick: () => void
  disabled: boolean
  optimizing?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onClick}
            disabled={disabled}
          >
            {optimizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}{" "}
            {optimizing
              ? t("conversation.optimizing")
              : t("conversation.optimizePrompt")}
          </Button>
        }
      />
      <TooltipContent>{t("conversation.optimizePrompt")}</TooltipContent>
    </Tooltip>
  )
}

export function SendStopButton({
  isStreaming,
  disabled,
  onSend,
  onStop,
}: {
  isStreaming?: boolean
  disabled: boolean
  onSend: () => void
  onStop?: () => void
}) {
  const { t } = useTranslation()
  if (isStreaming) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1.5 rounded-lg px-3 text-xs"
              onClick={onStop}
            >
              <Square className="h-3 w-3" /> {t("conversation.stop")}
            </Button>
          }
        />
        <TooltipContent>{t("conversation.stopGenerating")}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-3 text-xs disabled:opacity-30"
            onClick={onSend}
            disabled={disabled}
          >
            {t("conversation.send")}{" "}
            <CornerDownLeft className="h-3 w-3 opacity-60" />
          </Button>
        }
      />
      <TooltipContent>{t("conversation.sendMessage")}</TooltipContent>
    </Tooltip>
  )
}

export function InputBarFooterRight({
  tokenUsage,
  isStreaming,
  showOptimize,
  optimizing,
  optimizeDisabled,
  sendDisabled,
  onOptimizeClick,
  onSend,
  onStop,
}: {
  tokenUsage?: SessionTokenUsage
  isStreaming?: boolean
  showOptimize: boolean
  optimizing?: boolean
  optimizeDisabled: boolean
  sendDisabled: boolean
  onOptimizeClick: () => void
  onSend: () => void
  onStop?: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {tokenUsage && <TokenUsageIndicator usage={tokenUsage} />}
      {!isStreaming && showOptimize && (
        <OptimizeButton
          onClick={onOptimizeClick}
          disabled={optimizeDisabled}
          optimizing={optimizing}
        />
      )}
      <SendStopButton
        isStreaming={isStreaming}
        disabled={sendDisabled}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  )
}
