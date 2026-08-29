import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import {
  CodeBlock,
  DocsSection,
  EndpointCard,
  EndpointRow,
  FieldTable,
  SampleTabs,
  type FieldRow,
} from "@/components/docs/api-docs-ui"
import {
  buildRunSamples,
  buildTokenSamples,
} from "@/components/docs/api-docs-samples"
import { EventList, FlowSteps } from "@/components/docs/api-docs-widgets"

export function OverviewSection() {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="overview"
      title={t("apiDocs.overviewTitle")}
      hint={t("apiDocs.overviewHint")}
    >
      <FlowSteps />
    </DocsSection>
  )
}

function authHeaderRows(t: TFunction): FieldRow[] {
  return [
    {
      name: "Authorization",
      type: "header",
      required: true,
      desc: t("apiDocs.authHeaderBearer"),
    },
    { name: "X-API-Key", type: "header", desc: t("apiDocs.authHeaderKey") },
    { name: "access_token", type: "query", desc: t("apiDocs.authQuery") },
  ]
}

function loginFieldRows(t: TFunction): FieldRow[] {
  return [
    {
      name: "username",
      type: "string",
      required: true,
      desc: t("apiDocs.fieldUsername"),
    },
    {
      name: "password",
      type: "string",
      required: true,
      desc: t("apiDocs.fieldPassword"),
    },
  ]
}

function AuthEndpoints() {
  const { t } = useTranslation()
  return (
    <div className="space-y-8">
      <EndpointCard
        method="POST"
        path="/v1/auth/login"
        title={t("apiDocs.authLoginTitle")}
      >
        <FieldTable rows={loginFieldRows(t)} />
      </EndpointCard>
      <EndpointCard
        method="POST"
        path="/v1/auth/token"
        title={t("apiDocs.authTokenTitle")}
      >
        <FieldTable
          rows={[
            {
              name: "api_key",
              type: "string",
              required: true,
              desc: t("apiDocs.fieldApiKey"),
            },
          ]}
        />
      </EndpointCard>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("apiDocs.authKeysHint")}
      </p>
    </div>
  )
}

export function AuthSection({
  samples,
}: {
  samples: ReturnType<typeof buildTokenSamples>
}) {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="auth"
      title={t("apiDocs.authTitle")}
      hint={t("apiDocs.authHint")}
    >
      <div className="max-w-2xl">
        <FieldTable rows={authHeaderRows(t)} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <AuthEndpoints />
        <SampleTabs samples={samples} />
      </div>
    </DocsSection>
  )
}

function runFieldRows(t: TFunction): FieldRow[] {
  return [
    {
      name: "agent",
      type: "string",
      required: true,
      desc: t("apiDocs.fieldAgent"),
    },
    {
      name: "prompt",
      type: "string",
      required: true,
      desc: t("apiDocs.fieldPrompt"),
    },
    { name: "session_id", type: "string", desc: t("apiDocs.fieldSessionId") },
    { name: "workdir", type: "string", desc: t("apiDocs.fieldWorkdir") },
    { name: "images", type: "array", desc: t("apiDocs.fieldImages") },
    { name: "messages", type: "array", desc: t("apiDocs.fieldMessages") },
  ]
}

export function RunSection({
  samples,
}: {
  samples: ReturnType<typeof buildRunSamples>
}) {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="run"
      title={t("apiDocs.runTitle")}
      hint={t("apiDocs.runHint")}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <EndpointCard
          method="POST"
          path="/v1/agents/run"
          title={t("apiDocs.runEndpointTitle")}
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("apiDocs.runResponseHint")}
          </p>
          <FieldTable rows={runFieldRows(t)} />
        </EndpointCard>
        <SampleTabs samples={samples} />
      </div>
    </DocsSection>
  )
}

export function EventsSection() {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="events"
      title={t("apiDocs.eventsTitle")}
      hint={t("apiDocs.eventsHint")}
    >
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
  )
}

function approveFieldRows(t: TFunction): FieldRow[] {
  return [
    {
      name: "approval_id",
      type: "string",
      required: true,
      desc: t("apiDocs.fieldApprovalId"),
    },
    {
      name: "approved",
      type: "boolean",
      required: true,
      desc: t("apiDocs.fieldApproved"),
    },
  ]
}

export function ApproveSection({ base }: { base: string }) {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="approve"
      title={t("apiDocs.approveTitle")}
      hint={t("apiDocs.approveHint")}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <EndpointCard
          method="POST"
          path="/v1/agents/approve"
          title={t("apiDocs.approveEndpointTitle")}
        >
          <FieldTable rows={approveFieldRows(t)} />
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
  )
}

export function SessionSection({ base }: { base: string }) {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="session"
      title={t("apiDocs.sessionTitle")}
      hint={t("apiDocs.sessionHint")}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-1">
          <EndpointRow
            method="GET"
            path="/v1/sessions"
            title={t("apiDocs.sessionList")}
          />
          <EndpointRow
            method="GET"
            path="/v1/sessions/:id"
            title={t("apiDocs.sessionGet")}
          />
          <EndpointRow
            method="DELETE"
            path="/v1/sessions/:id"
            title={t("apiDocs.sessionDelete")}
          />
          <EndpointRow
            method="GET"
            path="/v1/agents"
            title={t("apiDocs.agentsList")}
          />
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
  )
}

export function ErrorsSection() {
  const { t } = useTranslation()
  return (
    <DocsSection
      id="errors"
      title={t("apiDocs.errorsTitle")}
      hint={t("apiDocs.errorsHint")}
    >
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
            {
              name: "Accept-Language",
              type: "header",
              desc: t("apiDocs.errLang"),
            },
          ]}
        />
      </div>
    </DocsSection>
  )
}
