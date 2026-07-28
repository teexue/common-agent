import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CopyButton } from "@/components/shared/copy-button"
import { cn } from "@/lib/utils"

const METHOD_CLASS: Record<string, string> = {
  GET: "bg-success/10 text-success",
  POST: "bg-primary/10 text-primary",
  PUT: "bg-warning/10 text-warning",
  PATCH: "bg-warning/10 text-warning",
  DELETE: "bg-destructive/10 text-destructive",
}

/** HTTP method pill. */
export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-block w-16 shrink-0 rounded-md px-2 py-0.5 text-center font-mono text-[11px] font-bold tracking-wider",
        METHOD_CLASS[method] ?? "bg-muted text-muted-foreground"
      )}
    >
      {method}
    </span>
  )
}

/** Copyable code block, same chrome as chat Markdown code blocks. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium text-muted-foreground">
          {label ?? "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-5 whitespace-pre text-foreground">
        {code}
      </pre>
    </div>
  )
}

/** Language samples with tabs inside the code chrome. */
export function SampleTabs({
  samples,
}: {
  samples: { id: string; label: string; code: string }[]
}) {
  const [tab, setTab] = useState(samples[0]?.id ?? "")
  if (samples.length === 0) return null

  const active = samples.find((s) => s.id === tab) ?? samples[0]

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full gap-0">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-2 py-1">
          <TabsList className="h-7 bg-transparent p-0.5">
            {samples.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="rounded-lg px-2.5 text-xs"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <CopyButton text={active.code} />
        </div>
        {samples.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-0">
            <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-5 whitespace-pre text-foreground">
              {s.code}
            </pre>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

export interface FieldRow {
  name: string
  type: string
  required?: boolean
  desc: string
}

/** Field rows as a relaxed definition list; parent provides the container. */
export function FieldTable({ rows }: { rows: FieldRow[] }) {
  const { t } = useTranslation()
  return (
    <dl className="space-y-4">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono text-[13px] font-medium text-foreground">
              {row.name}
            </code>
            <span className="font-mono text-xs text-muted-foreground">{row.type}</span>
            {row.required && (
              <span className="text-xs font-medium text-primary">
                {t("apiDocs.required")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.desc}</p>
        </div>
      ))}
    </dl>
  )
}

/** Endpoint block: method pill + path as the anchor, description below. */
export function EndpointCard({
  method,
  path,
  title,
  children,
}: {
  method: string
  path: string
  title: string
  children?: ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <MethodBadge method={method} />
        <code className="font-mono text-sm font-medium text-foreground">{path}</code>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{title}</p>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </div>
  )
}

/** Compact endpoint row for lists. */
export function EndpointRow({
  method,
  path,
  title,
}: {
  method: string
  path: string
  title: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      <MethodBadge method={method} />
      <code className="font-mono text-[13px] text-foreground">{path}</code>
      <span className="text-sm text-muted-foreground">{title}</span>
    </div>
  )
}

/** Section as one large surface: header rail + padded body wrapping all content. */
export function DocsSection({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="border-b border-border bg-muted/50 px-6 py-4">
        <h2 className="font-heading text-base tracking-tight text-foreground">{title}</h2>
        {hint && (
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </section>
  )
}
