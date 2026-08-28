import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"
import { Clock, File, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  asRecord,
  str,
  num,
  formatSize,
  type Rec,
} from "@/components/inspector/tool-detail-utils"
import {
  diffLines,
  addedLines,
  type DiffLine,
} from "@/components/inspector/diff-utils"
import type { ToolCallEntry } from "@/types/agent"

/** InlineToolDetail renders a compact, borderless, agentic-style detail for
 * a tool call inside the conversation stream — mono type, tiny labels, no
 * framed cards. Mirrors the inspector's per-tool data extraction but replaces
 * the heavy renderers with a dense inline layout. */

function Label({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function Note({
  children,
  tone = "muted",
}: {
  children: string
  tone?: "muted" | "warning"
}) {
  return (
    <p
      className={cn(
        "text-[11px]",
        tone === "warning" ? "text-warning" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

function CodeBlock({
  text,
  tone = "default",
}: {
  text: string
  tone?: "default" | "destructive"
}) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-md bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap",
        tone === "destructive" ? "text-destructive" : "text-foreground"
      )}
      style={{ maxHeight: "20rem" }}
    >
      {text}
    </pre>
  )
}

function DiffBlock({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="overflow-auto" style={{ maxHeight: "14rem" }}>
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "px-2.5 font-mono text-[11px] leading-relaxed whitespace-pre",
            l.type === "add" && "bg-success/10 text-success",
            l.type === "del" && "bg-destructive/10 text-destructive",
            l.type === "ctx" && "text-muted-foreground"
          )}
        >
          <span className="mr-1 select-none opacity-50">
            {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
          </span>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/** FileContentBlock renders file contents as numbered lines in a scrollable
 * frame, mirroring DiffBlock's compact editor-like layout so read_file and
 * edit_file details look consistent. */
function FileContentBlock({ text }: { text: string }) {
  const lines = text === "" ? [] : text.split("\n")
  if (lines.length === 0) return null
  return (
    <div className="overflow-auto" style={{ maxHeight: "14rem" }}>
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex gap-2 px-2.5 font-mono text-[11px] leading-relaxed whitespace-pre"
        >
          <span className="w-6 shrink-0 select-none text-right text-muted-foreground/50">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 break-all text-foreground">{l}</span>
        </div>
      ))}
    </div>
  )
}

function PathLine({ path }: { path: string }) {
  if (!path) return null
  return <p className="font-mono text-[11px] break-all text-foreground">{path}</p>
}

function lineCount(s: string): number {
  return s === "" ? 0 : s.split("\n").length
}

/** Meta renders a small pill used in the file panel header to surface the
 * operation's quantitative result (lines read, +A -D, replacements). */
function Meta({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "destructive" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        tone === "success" && "bg-success/15 text-success",
        tone === "destructive" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** FilePanel provides a unified framed layout for file tool details: a header
 * row with a file icon, the path, and a right-aligned meta slot, followed by a
 * bordered body. Used by read_file / write_file / edit_file. */
function FilePanel({
  path,
  meta,
  children,
}: {
  path: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-2.5 py-1.5">
        <File className="h-3 w-3 shrink-0 text-primary" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
          title={path}
        >
          {path}
        </span>
        {meta && <span className="flex shrink-0 items-center gap-1">{meta}</span>}
      </div>
      {children}
    </div>
  )
}

/** Terminal renders a pseudo-terminal chrome: a dark surface with a macOS-style
 * traffic-light header and a scrollable mono body. Used for run_command. */
function Terminal({
  label = "bash",
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-terminal-border bg-terminal">
      <div className="flex items-center gap-1.5 border-b border-terminal-border/60 px-2.5 py-1">
        <span className="h-2 w-2 rounded-full bg-terminal-error/70" />
        <span className="h-2 w-2 rounded-full bg-warning/70" />
        <span className="h-2 w-2 rounded-full bg-terminal-success/70" />
        <span className="ml-1.5 font-mono text-[10px] text-terminal-muted">{label}</span>
      </div>
      <div
        className="overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed"
        style={{ maxHeight: "14rem" }}
      >
        {children}
      </div>
    </div>
  )
}

function RunCommand({ input, output }: { input: Rec | null; output: Rec | null }) {
  const exitCode = num(output?.exit_code)
  const stdout = str(output?.stdout)
  const stderr = str(output?.stderr)
  const cmd = str(input?.command)
  const ok = exitCode === 0
  return (
    <Terminal>
      <div className="whitespace-pre-wrap break-all">
        <span className="select-none text-terminal-muted">$ </span>
        <span className="text-terminal-foreground">{cmd}</span>
      </div>
      {stdout && (
        <pre className="mt-1 whitespace-pre-wrap break-all text-terminal-foreground">
          {stdout}
        </pre>
      )}
      {stderr && (
        <pre className="mt-1 whitespace-pre-wrap break-all text-terminal-error">
          {stderr}
        </pre>
      )}
      {exitCode !== null && (
        <div className="mt-1 flex items-center gap-1.5 text-terminal-muted">
          <span className={ok ? "text-terminal-success" : "text-terminal-error"}>●</span>
          <span>exit {exitCode}</span>
          {output?.timed_out === true && (
            <span className="text-terminal-error">· timed out</span>
          )}
        </div>
      )}
    </Terminal>
  )
}

function ReadFile({ input, output }: { input: Rec | null; output: Rec | null }) {
  const path = str(input?.path) || str(output?.path)
  const content = str(output?.content)
  const lines = lineCount(content)
  const truncated = output?.truncated === true
  return (
    <FilePanel
      path={path}
      meta={
        <>
          {lines > 0 && <Meta>{`${lines} lines`}</Meta>}
          {truncated && <Meta tone="destructive">truncated</Meta>}
        </>
      }
    >
      {content && <FileContentBlock text={content} />}
    </FilePanel>
  )
}

function WriteFile({ input }: { input: Rec | null; output: Rec | null }) {
  const path = str(input?.path)
  const content = str(input?.content)
  const add = lineCount(content)
  return (
    <FilePanel path={path} meta={<Meta tone="success">{`+${add}`}</Meta>}>
      <DiffBlock lines={addedLines(content)} />
    </FilePanel>
  )
}

function EditFile({ input, output }: { input: Rec | null; output: Rec | null }) {
  const path = str(input?.path) || str(output?.path)
  const replacements = num(output?.replacements)
  const oldStr = str(input?.old_string)
  const newStr = str(input?.new_string)
  const lines = diffLines(oldStr, newStr)
  const add = lines.filter((l) => l.type === "add").length
  const del = lines.filter((l) => l.type === "del").length
  return (
    <FilePanel
      path={path}
      meta={
        <>
          {replacements !== null && <Meta>{`${replacements}× `}</Meta>}
          {add > 0 && <Meta tone="success">{`+${add}`}</Meta>}
          {del > 0 && <Meta tone="destructive">{`-${del}`}</Meta>}
        </>
      }
    >
      <DiffBlock lines={lines} />
    </FilePanel>
  )
}

interface DirEntry {
  name?: string
  size?: number
  is_dir?: boolean
}

function ListDirectory({ input, output }: { input: Rec | null; output: Rec | null }) {
  const entries = Array.isArray(output?.entries) ? (output.entries as DirEntry[]) : []
  const count = num(output?.count)
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={str(input?.path) || str(output?.path)} />
      {count !== null && <Note>{`${count} entries`}</Note>}
      <div className="flex flex-col">
        {entries.map((e, i) => (
          <div key={`${e.name}-${i}`} className="flex items-center gap-2 py-0.5">
            {e.is_dir ? (
              <Folder className="h-3 w-3 shrink-0 text-primary" />
            ) : (
              <File className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
              {e.name}
            </span>
            {typeof e.size === "number" && !e.is_dir && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {formatSize(e.size)}
              </span>
            )}
          </div>
        ))}
      </div>
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}

interface SearchMatch {
  file?: string
  line?: number
  column?: number
  text?: string
}

function SearchFiles({ input, output }: { input: Rec | null; output: Rec | null }) {
  const matches = Array.isArray(output?.matches) ? (output.matches as SearchMatch[]) : []
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={`${str(input?.pattern)}  —  ${str(input?.path) || str(output?.path)}`} />
      {num(output?.count) !== null && <Note>{`${num(output?.count)} matches`}</Note>}
      <div className="flex flex-col gap-1">
        {matches.map((m, i) => (
          <div key={i}>
            <p className="font-mono text-[10px] text-primary">
              {m.file}:{m.line}:{m.column}
            </p>
            <p className="font-mono text-[11px] break-all text-muted-foreground">
              {m.text}
            </p>
          </div>
        ))}
      </div>
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}

function WebFetch({ input, output }: { input: Rec | null; output: Rec | null }) {
  const status = num(output?.status)
  const body = str(output?.body)
  return (
    <div className="flex flex-col gap-1.5">
      <PathLine path={str(input?.url) || str(output?.url)} />
      {status !== null && (
        <span
          className={cn(
            "font-mono text-[11px]",
            status < 400 ? "text-success" : "text-destructive"
          )}
        >
          HTTP {status}
        </span>
      )}
      {body && (
        <div className="flex flex-col gap-1">
          <Label>{`body (${formatSize(num(output?.body_bytes) ?? body.length)})`}</Label>
          <CodeBlock text={body} />
        </div>
      )}
      {output?.truncated === true && <Note tone="warning">truncated</Note>}
    </div>
  )
}

function DelegateTask({ input, output }: { input: Rec | null; output: Rec | null }) {
  const response = str(output?.response)
  return (
    <div className="flex flex-col gap-1.5">
      {str(input?.agent) && <Note>{`agent: ${str(input?.agent)}`}</Note>}
      <CodeBlock text={str(input?.task)} />
      {num(output?.turns) !== null && <Note>{`turns: ${num(output?.turns)}`}</Note>}
      {response && (
        <div className="flex flex-col gap-1">
          <Label>response</Label>
          <CodeBlock text={response} />
        </div>
      )}
    </div>
  )
}

function LoadSkill({ input, output }: { input: Rec | null; output: Rec | null }) {
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

function GetTime({ output }: { input: Rec | null; output: Rec | null }) {
  const time = str(output?.time)
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-mono text-[11px] text-foreground">{time || "—"}</span>
    </div>
  )
}

const RENDERERS: Record<
  string,
  (props: { input: Rec | null; output: Rec | null }) => React.ReactNode
> = {
  run_command: RunCommand,
  read_file: ReadFile,
  write_file: WriteFile,
  edit_file: EditFile,
  create_directory: WriteFile,
  list_directory: ListDirectory,
  search_files: SearchFiles,
  web_fetch: WebFetch,
  delegate_task: DelegateTask,
  load_skill: LoadSkill,
  get_time: GetTime,
}

function Generic({ toolCall }: { toolCall: ToolCallEntry }) {
  const { t } = useTranslation()
  const hasOutput = toolCall.output !== undefined && toolCall.output !== null && toolCall.output !== ""
  const inputJson = toolCall.input ? JSON.stringify(toolCall.input, null, 2) : ""
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

/** InlineToolDetail renders the agentic-style detail body for a tool call. */
export function InlineToolDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  if (toolCall.status === "error") {
    const text =
      str(asRecord(toolCall.output)?.error) ||
      (typeof toolCall.output === "string"
        ? toolCall.output
        : JSON.stringify(toolCall.output))
    return <CodeBlock text={text || "error"} tone="destructive" />
  }

  const Renderer = RENDERERS[toolCall.name]
  if (!Renderer) return <Generic toolCall={toolCall} />

  return (
    <div className="flex flex-col gap-1.5">
      <Renderer input={asRecord(toolCall.input)} output={asRecord(toolCall.output)} />
    </div>
  )
}
