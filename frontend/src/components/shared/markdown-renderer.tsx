import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CopyButton } from "./copy-button"

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className ?? "")
  const isInline = !match && !String(children).includes("\n")

  if (isInline) {
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground ring-1 ring-border"
        {...props}
      >
        {children}
      </code>
    )
  }

  const code = String(children).replace(/\n$/, "")

  return (
    <div className="group relative my-2 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium text-muted-foreground">
          {match?.[1] ?? "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-[13px] leading-5" {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
}: {
  content: string
  isStreaming?: boolean
}) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          pre: ({ children }) => <>{children}</>,
          table: ({ children, ...props }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border-b border-border bg-muted/50 px-3 py-2 text-left font-semibold"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border-b border-border px-3 py-2" {...props}>
              {children}
            </td>
          ),
          ul: ({ children, ...props }) => (
            <ul
              className="list-disc pl-5 marker:text-muted-foreground/50"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="list-decimal pl-5 marker:text-muted-foreground/50"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="my-1" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-2 border-primary/20 pl-3 text-muted-foreground italic"
              {...props}
            >
              {children}
            </blockquote>
          ),
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary"
              {...props}
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-border" />,
          p: ({ children, ...props }) => <p {...props}>{children}</p>,
          h1: ({ children, ...props }) => (
            <h1
              className="mb-2 mt-4 font-heading text-lg tracking-tight text-foreground"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="mb-1.5 mt-3 font-heading text-base tracking-tight text-foreground"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="mb-1 mt-2.5 font-heading text-sm tracking-tight text-foreground"
              {...props}
            >
              {children}
            </h3>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </Markdown>
      {isStreaming && (
        <span
          className="inline-block w-px animate-pulse bg-primary align-baseline"
          style={{ height: "1em" }}
        />
      )}
    </div>
  )
}
