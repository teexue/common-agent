import { asRecord, str } from "@/components/inspector/tool-detail-utils"
import type { ToolCallEntry } from "@/types/agent"
import { RunCommand } from "./inline-tool-command"
import { EditFile, ReadFile, WriteFile, DeleteFile } from "./inline-tool-file"
import { ListDirectory, SearchFiles } from "./inline-tool-fs"
import { ReadImage } from "./inline-tool-image"
import { DelegateTask, Generic, GetTime, LoadSkill } from "./inline-tool-misc"
import { CodeBlock, type ToolRenderProps } from "./inline-tool-primitives"
import { WebFetch } from "./inline-tool-web"

const RENDERERS: Record<string, (props: ToolRenderProps) => React.ReactNode> = {
  run_command: RunCommand,
  read_file: ReadFile,
  read_image: ReadImage,
  write_file: WriteFile,
  delete_file: DeleteFile,
  edit_file: EditFile,
  create_directory: WriteFile,
  list_directory: ListDirectory,
  search_files: SearchFiles,
  web_fetch: WebFetch,
  delegate_task: DelegateTask,
  load_skill: LoadSkill,
  get_time: GetTime,
}

function errorText(toolCall: ToolCallEntry): string {
  const fromRec = str(asRecord(toolCall.output)?.error)
  if (fromRec) return fromRec
  if (typeof toolCall.output === "string") return toolCall.output
  return JSON.stringify(toolCall.output)
}

/** InlineToolDetail renders the agentic-style detail body for a tool call. */
export function InlineToolDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  if (toolCall.status === "error") {
    return (
      <CodeBlock text={errorText(toolCall) || "error"} tone="destructive" />
    )
  }
  const Renderer = RENDERERS[toolCall.name]
  if (!Renderer) return <Generic toolCall={toolCall} />
  return (
    <div className="flex flex-col gap-1.5">
      <Renderer
        input={asRecord(toolCall.input)}
        output={asRecord(toolCall.output)}
      />
    </div>
  )
}
