import { useTranslation } from "react-i18next"
import { File, Folder } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeBlock } from "@/components/artifact/code-block"
import { JsonViewer } from "@/components/artifact/json-viewer"
import { MarkdownRenderer } from "@/components/shared/markdown-renderer"
import { DiffView } from "./diff-view"
import { addedLines, diffLines } from "./diff-utils"
import { cn } from "@/lib/utils"
import type { ToolCallEntry } from "@/types/agent"

// ─── Helpers ─────────────────────────────────────────────────────

type Rec = Record<string, unknown>

/** asRecord normalizes tool input/output (object or JSON string) to a record. */
function asRecord(v: unknown): Rec | null {
  if (v == null) return null
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v)
      return typeof parsed === "object" && parsed !== null ? (parsed as Rec) : null
    } catch {
      return null
    }
  }
  return typeof v === "object" ? (v as Rec) : null
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null
}

/** langFromPath guesses a language label from a file extension. */
function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", go: "go",
    py: "python", rs: "rust", java: "java", json: "json", yaml: "yaml",
    yml: "yaml", md: "markdown", sh: "bash", css: "css", html: "html",
  }
  return map[ext] ?? ext ?? "text"
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** PathRow renders the target path as a prominent mono row. */
function PathRow({ path }: { path: string }) {
  if (!path) return null
  return (
    <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
      {path}
    </p>
  )
}

/** NoteLine renders small meta text (truncated, counts…). */
function NoteLine({ children, tone = "muted" }: { children: string; tone?: "muted" | "warning" }) {
  return (
    <p className={cn("text-[11px]", tone === "warning" ? "text-warning" : "text-muted-foreground")}>
      {children}
    </p>
  )
}

// ─── Per-tool renderers ──────────────────────────────────────────

function RunCommandDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const exitCode = num(output?.exit_code)
  const stdout = str(output?.stdout)
  const stderr = str(output?.stderr)
  return (
    <>
      <CodeBlock code={`$ ${str(input?.command)}`} language="bash" title="command" />
      {exitCode !== null && (
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-md px-1.5 py-0 font-mono text-xs",
              exitCode === 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            exit {exitCode}
          </Badge>
          {output?.timed_out === true && <NoteLine tone="warning">timed out</NoteLine>}
        </div>
      )}
      {stdout && <CodeBlock code={stdout} title="stdout" />}
      {stderr && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-destructive uppercase">stderr</p>
          <pre className="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-destructive">{stderr}</pre>
        </div>
      )}
    </>
  )
}

function ReadFileDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const path = str(input?.path) || str(output?.path)
  const content = str(output?.content)
  return (
    <>
      <PathRow path={path} />
      {output?.truncated === true && <NoteLine tone="warning">truncated</NoteLine>}
      {content && <CodeBlock code={content} language={langFromPath(path)} />}
    </>
  )
}

function WriteFileDetail({ input }: { input: Rec | null; output: Rec | null }) {
  const path = str(input?.path)
  const content = str(input?.content)
  return (
    <>
      <PathRow path={path} />
      {content && <DiffView lines={addedLines(content)} />}
    </>
  )
}

function EditFileDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const oldStr = str(input?.old_string)
  const newStr = str(input?.new_string)
  const replacements = num(output?.replacements)
  return (
    <>
      <PathRow path={str(input?.path) || str(output?.path)} />
      {replacements !== null && <NoteLine>{`replacements: ${replacements}`}</NoteLine>}
      <DiffView lines={diffLines(oldStr, newStr)} />
    </>
  )
}

interface DirEntry {
  name?: string
  size?: number
  is_dir?: boolean
}

function ListDirectoryDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const entries = Array.isArray(output?.entries) ? (output.entries as DirEntry[]) : []
  const count = num(output?.count)
  return (
    <>
      <PathRow path={str(input?.path) || str(output?.path)} />
      {count !== null && <NoteLine>{`${count} entries`}</NoteLine>}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {entries.map((e, i) => (
          <div key={`${e.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
            {e.is_dir ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{e.name}</span>
            {typeof e.size === "number" && !e.is_dir && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatSize(e.size)}</span>
            )}
          </div>
        ))}
      </div>
      {output?.truncated === true && <NoteLine tone="warning">truncated</NoteLine>}
    </>
  )
}

interface SearchMatch {
  file?: string
  line?: number
  column?: number
  text?: string
}

function SearchFilesDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const matches = Array.isArray(output?.matches) ? (output.matches as SearchMatch[]) : []
  return (
    <>
      <PathRow path={`${str(input?.pattern)}  —  ${str(input?.path) || str(output?.path)}`} />
      {num(output?.count) !== null && <NoteLine>{`${num(output?.count)} matches`}</NoteLine>}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {matches.map((m, i) => (
          <div key={i} className="px-3 py-1.5">
            <p className="font-mono text-[11px] text-primary">
              {m.file}:{m.line}:{m.column}
            </p>
            <p className="mt-0.5 font-mono text-xs break-all text-foreground">{m.text}</p>
          </div>
        ))}
      </div>
      {output?.truncated === true && <NoteLine tone="warning">truncated</NoteLine>}
    </>
  )
}

function WebFetchDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const status = num(output?.status)
  const body = str(output?.body)
  return (
    <>
      <PathRow path={str(input?.url) || str(output?.url)} />
      {status !== null && (
        <Badge
          variant="secondary"
          className={cn(
            "w-fit rounded-md px-1.5 py-0 font-mono text-xs",
            status < 400 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          HTTP {status}
        </Badge>
      )}
      {body && (
        <div className="max-h-96 overflow-auto">
          <CodeBlock code={body} title={`body (${formatSize(num(output?.body_bytes) ?? body.length)})`} />
        </div>
      )}
      {output?.truncated === true && <NoteLine tone="warning">truncated</NoteLine>}
    </>
  )
}

function DelegateTaskDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const response = str(output?.response)
  return (
    <>
      {str(input?.agent) && <NoteLine>{`agent: ${str(input?.agent)}`}</NoteLine>}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{str(input?.task)}</p>
      </div>
      {num(output?.turns) !== null && <NoteLine>{`turns: ${num(output?.turns)}`}</NoteLine>}
      {response && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <MarkdownRenderer content={response} />
        </div>
      )}
    </>
  )
}

function LoadSkillDetail({ input, output }: { input: Rec | null; output: Rec | null }) {
  const instructions = str(output?.instructions)
  return (
    <>
      <PathRow path={`${str(input?.name)}  —  ${str(output?.base_dir)}`} />
      {instructions && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <MarkdownRenderer content={instructions} />
        </div>
      )}
    </>
  )
}

// ─── Dispatcher ──────────────────────────────────────────────────

const RENDERERS: Record<string, (props: { input: Rec | null; output: Rec | null }) => React.ReactNode> = {
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
  const hasOutput = toolCall.output !== undefined && toolCall.output !== null && toolCall.output !== ""
  return (
    <Tabs defaultValue="input">
      <TabsList className="w-full rounded-xl bg-muted p-0.5">
        <TabsTrigger value="input" className="flex-1 rounded-lg text-xs">{t("common.input")}</TabsTrigger>
        <TabsTrigger value="output" className="flex-1 rounded-lg text-xs">{t("common.output")}</TabsTrigger>
      </TabsList>
      <TabsContent value="input" className="mt-3"><JsonViewer data={toolCall.input} title="Input" /></TabsContent>
      <TabsContent value="output" className="mt-3">
        {hasOutput ? <JsonViewer data={toolCall.output} title="Output" /> : <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t("inspector.noOutput")}</p>}
      </TabsContent>
    </Tabs>
  )
}

/** ToolCallDetailBody renders a purpose-built view per tool, with a generic fallback. */
export function ToolCallDetailBody({ toolCall }: { toolCall: ToolCallEntry }) {
  const Renderer = RENDERERS[toolCall.name]

  if (toolCall.status === "error") {
    const text = str(asRecord(toolCall.output)?.error) ||
      (typeof toolCall.output === "string" ? toolCall.output : JSON.stringify(toolCall.output))
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <pre className="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-destructive">{text}</pre>
      </div>
    )
  }

  if (!Renderer) return <GenericDetail toolCall={toolCall} />

  return (
    <div className="flex flex-col gap-3">
      <Renderer input={asRecord(toolCall.input)} output={asRecord(toolCall.output)} />
    </div>
  )
}
