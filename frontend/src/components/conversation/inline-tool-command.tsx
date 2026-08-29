import { str, num } from "@/components/inspector/tool-detail-utils"
import { Terminal, type ToolRenderProps } from "./inline-tool-primitives"

export function RunCommand({ input, output }: ToolRenderProps) {
  const exitCode = num(output?.exit_code)
  const stdout = str(output?.stdout)
  const stderr = str(output?.stderr)
  const cmd = str(input?.command)
  const ok = exitCode === 0
  return (
    <Terminal>
      <div className="break-all whitespace-pre-wrap">
        <span className="text-terminal-muted select-none">$ </span>
        <span className="text-terminal-foreground">{cmd}</span>
      </div>
      {stdout && (
        <pre className="mt-1 break-all whitespace-pre-wrap text-terminal-foreground">
          {stdout}
        </pre>
      )}
      {stderr && (
        <pre className="mt-1 break-all whitespace-pre-wrap text-terminal-error">
          {stderr}
        </pre>
      )}
      {exitCode !== null && (
        <div className="mt-1 flex items-center gap-1.5 text-terminal-muted">
          <span
            className={ok ? "text-terminal-success" : "text-terminal-error"}
          >
            ●
          </span>
          <span>exit {exitCode}</span>
          {output?.timed_out === true && (
            <span className="text-terminal-error">· timed out</span>
          )}
        </div>
      )}
    </Terminal>
  )
}
