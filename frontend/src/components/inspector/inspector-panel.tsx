import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyInspector } from "./empty-inspector"
import { JsonViewer } from "@/components/artifact/json-viewer"
import { CodeBlock } from "@/components/artifact/code-block"
import type { ConversationEntry, ToolCallEntry } from "@/types/agent"

interface InspectorPanelProps {
  entry: ConversationEntry | null
  toolCall: ToolCallEntry | null
}

function hasOutput(toolCall: ToolCallEntry): boolean {
  return toolCall.output !== undefined && toolCall.output !== null && toolCall.output !== ""
}

function ToolCallDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("inspector.toolCall")}</p>
          <h3 className="mt-0.5 font-mono text-sm font-semibold text-foreground">{toolCall.name}</h3>
        </div>
        <Separator />
        <Tabs defaultValue="input">
          <TabsList className="w-full rounded-xl bg-muted p-0.5">
            <TabsTrigger value="input" className="flex-1 rounded-lg text-xs">{t("common.input")}</TabsTrigger>
            <TabsTrigger value="output" className="flex-1 rounded-lg text-xs">{t("common.output")}</TabsTrigger>
          </TabsList>
          <TabsContent value="input" className="mt-3"><JsonViewer data={toolCall.input} title="Input" /></TabsContent>
          <TabsContent value="output" className="mt-3">
            {hasOutput(toolCall) ? <JsonViewer data={toolCall.output} title="Output" /> : <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t("inspector.noOutput")}</p>}
          </TabsContent>
        </Tabs>
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
          <h3 className="mt-0.5 font-heading text-sm capitalize text-foreground">{entry.role}</h3>
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
            <div className="flex flex-col gap-2">{entry.toolCalls.map((tc) => <JsonViewer key={tc.id} data={tc} title={tc.name} />)}</div>
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
