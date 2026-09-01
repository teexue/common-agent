import { useTranslation } from "react-i18next"
import { CornerDownLeft, Loader2, Plus, Sparkles, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function AttachFilesButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClick}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <TooltipContent>{t("conversation.attachFiles")}</TooltipContent>
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
      <SendStopTrigger
        variant="destructive"
        tooltip={t("conversation.composerStopHint")}
        onClick={onStop}
      >
        <Square className="h-3 w-3" /> {t("conversation.stop")}
      </SendStopTrigger>
    )
  }
  return (
    <SendStopTrigger
      tooltip={t("conversation.composerSendHint")}
      disabled={disabled}
      onClick={onSend}
    >
      {t("conversation.send")} <CornerDownLeft className="h-3 w-3 opacity-60" />
    </SendStopTrigger>
  )
}

function SendStopTrigger({
  variant,
  tooltip,
  disabled,
  onClick,
  children,
}: {
  variant?: "destructive"
  tooltip: string
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant={variant}
            className="h-7 gap-1.5 rounded-lg px-3 text-xs disabled:opacity-30"
            onClick={onClick}
            disabled={disabled}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function InputBarFooterRight({
  isStreaming,
  showOptimize,
  optimizing,
  optimizeDisabled,
  sendDisabled,
  onOptimizeClick,
  onSend,
  onStop,
}: {
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
    <div className="flex shrink-0 items-center gap-1">
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
