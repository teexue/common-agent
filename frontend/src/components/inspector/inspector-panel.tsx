import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { EmptyInspector } from "./empty-inspector"
import { ToolCallDetailBody } from "./tool-call-detail"
import { JsonViewer } from "@/components/artifact/json-viewer"
import { CodeBlock } from "@/components/artifact/code-block"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"

interface InspectorPanelProps {
  entry: ConversationEntry | null
  toolCall: ToolCallEntry | null
}

function ToolCallDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("inspector.toolCall")}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-foreground" title={toolCall.name}>{toolDisplayName(toolCall.name, t)}</h3>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{toolCall.name}</p>
        </div>
        <Separator />
        <ToolCallDetailBody toolCall={toolCall} />
      </div>
    </ScrollArea>
  )
}

function EntryDetail({ entry }: { entry: ConversationEntry }) {
  const { t } = useTranslation()
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{entry.role === "user" ? t("inspector.userMessage") : t("inspector.assistantReply")}</p>
          <h3 className="mt-0.5 text-sm font-medium capitalize text-foreground">{entry.role}</h3>
        </div>
        <Separator />
        {entry.reasoningContent && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("inspector.reasoning")}</h4>
            <div className="rounded-xl border border-border bg-card p-3"><p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{entry.reasoningContent}</p></div>
          </div>
        )}
        {entry.content && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("inspector.content")}</h4>
            {entry.content.includes("```") ? <CodeBlock code={entry.content} language="text" /> : <div className="rounded-xl border border-border bg-card p-3"><p className="whitespace-pre-wrap text-xs leading-relaxed">{entry.content}</p></div>}
          </div>
        )}
        {entry.toolCalls && entry.toolCalls.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("inspector.toolCalls", { count: entry.toolCalls.length })}</h4>
            <div className="flex flex-col gap-2">{entry.toolCalls.map((tc) => <JsonViewer key={tc.id} data={tc} title={toolDisplayName(tc.name, t)} />)}</div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

export function InspectorPanel({ entry, toolCall }: InspectorPanelProps) {
  if (toolCall) return <ToolCallDetail toolCall={toolCall} />
  if (entry) return <EntryDetail entry={entry} />
  return <EmptyInspector />
}
