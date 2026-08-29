import { useTranslation } from "react-i18next"
import { Clock } from "lucide-react"
import { str, num } from "@/components/inspector/tool-detail-utils"
import type { ToolCallEntry } from "@/types/agent"
import {
  CodeBlock,
  Label,
  Note,
  PathLine,
  type ToolRenderProps,
} from "./inline-tool-primitives"

export function DelegateTask({ input, output }: ToolRenderProps) {
  const response = str(output?.response)
  return (
    <div className="flex flex-col gap-1.5">
      {str(input?.agent) && <Note>{`agent: ${str(input?.agent)}`}</Note>}
      <CodeBlock text={str(input?.task)} />
      {num(output?.turns) !== null && (
        <Note>{`turns: ${num(output?.turns)}`}</Note>
      )}
      {response && (
        <div className="flex flex-col gap-1">
          <Label>response</Label>
          <CodeBlock text={response} />
        </div>
      )}
    </div>
  )
}

export function LoadSkill({ input, output }: ToolRenderProps) {
  const instructions = str(output?.instructions)
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={`${str(input?.name)}  —  ${str(output?.base_dir)}`} />
      {instructions && (
        <div className="flex flex-col gap-1">
          <Label>instructions</Label>
          <CodeBlock text={instructions} />
        </div>
      )}
    </div>
  )
}

export function GetTime({ output }: ToolRenderProps) {
  const time = str(output?.time)
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-mono text-[11px] text-foreground">
        {time || "—"}
      </span>
    </div>
  )
}

export function Generic({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  const hasOutput =
    toolCall.output !== undefined &&
    toolCall.output !== null &&
    toolCall.output !== ""
  const inputJson = toolCall.input
    ? JSON.stringify(toolCall.input, null, 2)
    : ""
  const outputJson = hasOutput
    ? typeof toolCall.output === "string"
      ? toolCall.output
      : JSON.stringify(toolCall.output, null, 2)
    : ""
  return (
    <div className="flex flex-col gap-1.5">
      {inputJson && (
        <div className="flex flex-col gap-1">
          <Label>{t("common.input")}</Label>
          <CodeBlock text={inputJson} />
        </div>
      )}
      {outputJson ? (
        <div className="flex flex-col gap-1">
          <Label>{t("common.output")}</Label>
          <CodeBlock text={outputJson} />
        </div>
      ) : (
        <Note>{t("inspector.noOutput")}</Note>
      )}
    </div>
  )
}
