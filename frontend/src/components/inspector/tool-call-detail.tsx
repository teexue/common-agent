import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonViewer } from "@/components/artifact/json-viewer"
import type { ToolCallEntry } from "@/types/agent"
import { asRecord, str } from "./tool-detail-utils"
import type { Rec } from "./tool-detail-utils"
import {
  DelegateTaskDetail,
  EditFileDetail,
  ListDirectoryDetail,
  LoadSkillDetail,
  ReadFileDetail,
  RunCommandDetail,
  SearchFilesDetail,
  WebFetchDetail,
  WriteFileDetail,
} from "./tool-detail-renderers"

// ─── Dispatcher ──────────────────────────────────────────────────

const RENDERERS: Record<
  string,
  (props: { input: Rec | null; output: Rec | null }) => React.ReactNode
> = {
  run_command: RunCommandDetail,
  read_file: ReadFileDetail,
  write_file: WriteFileDetail,
  edit_file: EditFileDetail,
  create_directory: WriteFileDetail,
  list_directory: ListDirectoryDetail,
  search_files: SearchFilesDetail,
  web_fetch: WebFetchDetail,
  delegate_task: DelegateTaskDetail,
  load_skill: LoadSkillDetail,
}

/** GenericDetail is the fallback for tools without a custom renderer. */
function GenericDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  const hasOutput =
    toolCall.output !== undefined &&
    toolCall.output !== null &&
    toolCall.output !== ""
  return (
    <Tabs defaultValue="input">
      <TabsList className="w-full rounded-xl bg-muted p-0.5">
        <TabsTrigger value="input" className="flex-1 rounded-lg text-xs">
          {t("common.input")}
        </TabsTrigger>
        <TabsTrigger value="output" className="flex-1 rounded-lg text-xs">
          {t("common.output")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="input" className="mt-3">
        <JsonViewer data={toolCall.input} title="Input" />
      </TabsContent>
      <TabsContent value="output" className="mt-3">
        {hasOutput ? (
          <JsonViewer data={toolCall.output} title="Output" />
        ) : (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            {t("inspector.noOutput")}
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}

/** ToolCallDetailBody renders a purpose-built view per tool, with a generic fallback. */
export function ToolCallDetailBody({ toolCall }: { toolCall: ToolCallEntry }) {
  const Renderer = RENDERERS[toolCall.name]

  if (toolCall.status === "error") {
    const text =
      str(asRecord(toolCall.output)?.error) ||
      (typeof toolCall.output === "string"
        ? toolCall.output
        : JSON.stringify(toolCall.output))
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <pre className="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-destructive">
          {text}
        </pre>
      </div>
    )
  }

  if (!Renderer) return <GenericDetail toolCall={toolCall} />

  return (
    <div className="flex flex-col gap-3">
      <Renderer
        input={asRecord(toolCall.input)}
        output={asRecord(toolCall.output)}
      />
    </div>
  )
}
