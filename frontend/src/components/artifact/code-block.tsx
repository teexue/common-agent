import { CopyButton } from "@/components/shared/copy-button"

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
}

export function CodeBlock({ code, language, title }: CodeBlockProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
          )}
          {language && (
            <span className="rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
              {language}
            </span>
          )}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-auto p-3">
        <code className="font-mono text-xs leading-5">{code}</code>
      </pre>
    </div>
  )
}
