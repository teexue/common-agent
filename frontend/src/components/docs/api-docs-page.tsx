import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, FileCode2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  DocsSection,
  EndpointCard,
  EndpointRow,
  FieldTable,
  SampleTabs,
} from "@/components/docs/api-docs-ui"
import { buildRunSamples, buildTokenSamples } from "@/components/docs/api-docs-samples"
import { CopyButton } from "@/components/shared/copy-button"
import { cn } from "@/lib/utils"

const SECTIONS = [
  "overview",
  "auth",
  "run",
  "events",
  "approve",
  "session",
  "errors",
] as const

type SectionId = (typeof SECTIONS)[number]

function useBaseURL() {
  return useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:8080"
    return window.location.origin
  }, [])
}

function BaseURLChip({ url }: { url: string }) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{t("apiDocs.baseUrl")}</span>
      <code className="truncate font-mono text-xs text-foreground">{url}</code>
      <CopyButton text={url} />
    </div>
  )
}

function FlowSteps() {
  const { t } = useTranslation()
  const steps = [t("apiDocs.flow1"), t("apiDocs.flow2"), t("apiDocs.flow3"), t("apiDocs.flow4")]
  return (
    <ol className="space-y-3">
      {steps.map((text, i) => (
        <li key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-medium text-primary">
            {i + 1}
          </span>
          <p className="max-w-2xl text-sm leading-relaxed text-foreground">{text}</p>
        </li>
      ))}
    </ol>
  )
}

function EventList({ items }: { items: { name: string; desc: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.name} className="flex items-baseline gap-3">
          <Radio className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-primary" />
          <code className="w-44 shrink-0 font-mono text-[13px] text-foreground">{item.name}</code>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
        </li>
      ))}
    </ul>
  )
}

function DocsToc({
  active,
  onSelect,
}: {
  active: SectionId
  onSelect: (id: SectionId) => void
}) {
  const { t } = useTranslation()
  return (
    <nav className="hidden w-52 shrink-0 overflow-auto border-r border-border px-3 py-4 lg:block">
      <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
        {t("apiDocs.toc")}
      </p>
      <ul className="space-y-0.5">
        {SECTIONS.map((id) => {
          const on = active === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  on
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {t(`apiDocs.nav.${id}`)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Interactive API integration guide (not Markdown). */
export function ApiDocsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const base = useBaseURL()
  const [active, setActive] = useState<SectionId>("overview")
  const runSamples = useMemo(() => buildRunSamples(base), [base])
  const tokenSamples = useMemo(
    () => buildTokenSamples(base, t("apiDocs.sampleLogin"), t("apiDocs.sampleExchange")),
    [base, t]
  )

  useEffect(() => {
    const nodes = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (nodes.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActive(visible.target.id as SectionId)
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.2, 0.5, 1] }
    )
    nodes.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [])

  const scrollTo = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setActive(id)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-primary" />
          <h1 className="font-heading text-base tracking-tight text-foreground">
            {t("apiDocs.title")}
          </h1>
        </div>
        <div className="flex-1" />
        <BaseURLChip url={base} />
      </header>

      <div className="flex min-h-0 flex-1">
        <DocsToc active={active} onSelect={scrollTo} />

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
            {SECTIONS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 text-xs transition-colors",
                  active === id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {t(`apiDocs.nav.${id}`)}
              </button>
            ))}
          </div>

          <div className="w-full space-y-6 px-6 py-6 pb-16">
            <DocsSection id="overview" title={t("apiDocs.overviewTitle")} hint={t("apiDocs.overviewHint")}>
              <FlowSteps />
            </DocsSection>

            <DocsSection id="auth" title={t("apiDocs.authTitle")} hint={t("apiDocs.authHint")}>
              <div className="max-w-2xl">
                <FieldTable
                  rows={[
                    { name: "Authorization", type: "header", required: true, desc: t("apiDocs.authHeaderBearer") },
                    { name: "X-API-Key", type: "header", desc: t("apiDocs.authHeaderKey") },
                    { name: "access_token", type: "query", desc: t("apiDocs.authQuery") },
                  ]}
                />
              </div>
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-8">
                  <EndpointCard method="POST" path="/v1/auth/login" title={t("apiDocs.authLoginTitle")}>
                    <FieldTable
                      rows={[
                        { name: "username", type: "string", required: true, desc: t("apiDocs.fieldUsername") },
                        { name: "password", type: "string", required: true, desc: t("apiDocs.fieldPassword") },
                      ]}
                    />
                  </EndpointCard>
                  <EndpointCard method="POST" path="/v1/auth/token" title={t("apiDocs.authTokenTitle")}>
                    <FieldTable
                      rows={[{ name: "api_key", type: "string", required: true, desc: t("apiDocs.fieldApiKey") }]}
                    />
                  </EndpointCard>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("apiDocs.authKeysHint")}</p>
                </div>
                <SampleTabs samples={tokenSamples} />
              </div>
            </DocsSection>

            <DocsSection id="run" title={t("apiDocs.runTitle")} hint={t("apiDocs.runHint")}>
              <div className="grid gap-8 lg:grid-cols-2">
                <EndpointCard method="POST" path="/v1/agents/run" title={t("apiDocs.runEndpointTitle")}>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("apiDocs.runResponseHint")}</p>
                  <FieldTable
                    rows={[
                      { name: "agent", type: "string", required: true, desc: t("apiDocs.fieldAgent") },
                      { name: "prompt", type: "string", required: true, desc: t("apiDocs.fieldPrompt") },
                      { name: "session_id", type: "string", desc: t("apiDocs.fieldSessionId") },
                      { name: "workdir", type: "string", desc: t("apiDocs.fieldWorkdir") },
                      { name: "images", type: "array", desc: t("apiDocs.fieldImages") },
                      { name: "messages", type: "array", desc: t("apiDocs.fieldMessages") },
                    ]}
                  />
                </EndpointCard>
                <SampleTabs samples={runSamples} />
              </div>
            </DocsSection>

            <DocsSection id="events" title={t("apiDocs.eventsTitle")} hint={t("apiDocs.eventsHint")}>
              <div className="grid gap-8 lg:grid-cols-2">
                <CodeBlock
                  label="SSE"
                  code={`data: {"type":"text_delta","content":"你好"}\n\ndata: {"type":"done","status":"completed","session_id":"sess_...","turns":1}`}
                />
                <EventList
                  items={[
                    { name: "text_delta", desc: t("apiDocs.evText") },
                    { name: "reasoning_delta", desc: t("apiDocs.evReasoning") },
                    { name: "tool_start", desc: t("apiDocs.evToolStart") },
                    { name: "tool_result", desc: t("apiDocs.evToolResult") },
                    { name: "tool_approval_required", desc: t("apiDocs.evApproval") },
                    { name: "error", desc: t("apiDocs.evError") },
                    { name: "done", desc: t("apiDocs.evDone") },
                  ]}
                />
              </div>
            </DocsSection>

            <DocsSection id="approve" title={t("apiDocs.approveTitle")} hint={t("apiDocs.approveHint")}>
              <div className="grid gap-8 lg:grid-cols-2">
                <EndpointCard method="POST" path="/v1/agents/approve" title={t("apiDocs.approveEndpointTitle")}>
                  <FieldTable
                    rows={[
                      { name: "approval_id", type: "string", required: true, desc: t("apiDocs.fieldApprovalId") },
                      { name: "approved", type: "boolean", required: true, desc: t("apiDocs.fieldApproved") },
                    ]}
                  />
                </EndpointCard>
                <CodeBlock
                  label="cURL"
                  code={`curl -X POST "${base}/v1/agents/approve" \\
  -H "Authorization: Bearer <JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"approval_id":"appr_...","approved":true}'`}
                />
              </div>
            </DocsSection>

            <DocsSection id="session" title={t("apiDocs.sessionTitle")} hint={t("apiDocs.sessionHint")}>
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-1">
                  <EndpointRow method="GET" path="/v1/sessions" title={t("apiDocs.sessionList")} />
                  <EndpointRow method="GET" path="/v1/sessions/:id" title={t("apiDocs.sessionGet")} />
                  <EndpointRow method="DELETE" path="/v1/sessions/:id" title={t("apiDocs.sessionDelete")} />
                  <EndpointRow method="GET" path="/v1/agents" title={t("apiDocs.agentsList")} />
                </div>
                <CodeBlock
                  label="cURL"
                  code={`curl -N -X POST "${base}/v1/agents/run" \\
  -H "Authorization: Bearer <JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "agt_demo01",
    "prompt": "继续上一个话题",
    "session_id": "sess_..."
  }'`}
                />
              </div>
            </DocsSection>

            <DocsSection id="errors" title={t("apiDocs.errorsTitle")} hint={t("apiDocs.errorsHint")}>
              <div className="grid gap-8 lg:grid-cols-2">
                <CodeBlock
                  label="JSON"
                  code={`{
  "code": "unauthorized",
  "message": "...",
  "details": "optional detail"
}`}
                />
                <FieldTable
                  rows={[
                    { name: "401", type: "HTTP", desc: t("apiDocs.err401") },
                    { name: "400", type: "HTTP", desc: t("apiDocs.err400") },
                    { name: "404", type: "HTTP", desc: t("apiDocs.err404") },
                    { name: "Accept-Language", type: "header", desc: t("apiDocs.errLang") },
                  ]}
                />
              </div>
            </DocsSection>
          </div>
        </main>
      </div>
    </div>
  )
}
