import { useTranslation } from "react-i18next"
import { Settings, Shield, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toolDisplayName } from "@/lib/tool-i18n"
import type { AgentDetail } from "@/types/agent"

export function AgentDetailBody({ detail }: { detail: AgentDetail }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <InfoCard
          label={t("agent.maxTurns")}
          value={
            detail.max_turns > 0
              ? String(detail.max_turns)
              : t("common.unlimited")
          }
        />
        <InfoCard
          label={t("agent.maxTokens")}
          value={
            detail.max_tokens
              ? String(detail.max_tokens)
              : t("common.unlimited")
          }
        />
        {detail.tool_execution && (
          <>
            <InfoCard
              label={t("agent.execMode")}
              value={
                detail.tool_execution.Mode === "parallel"
                  ? t("common.parallel")
                  : t("common.serial")
              }
            />
            <InfoCard
              label={t("agent.maxParallel")}
              value={String(detail.tool_execution.MaxParallel)}
            />
          </>
        )}
      </div>
      {detail.system_prompt && <PromptBlock prompt={detail.system_prompt} />}
      {(detail.tools ?? []).length > 0 && <ToolsBlock tools={detail.tools} />}
      {detail.permissions && (
        <PermissionsSection permissions={detail.permissions} />
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-medium text-foreground">
        {value}
      </p>
    </div>
  )
}

function PromptBlock({ prompt }: { prompt: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Settings className="h-3 w-3" /> {t("agent.systemPrompt")}
      </h4>
      <div className="max-h-60 overflow-auto rounded-xl border border-border bg-muted/50 p-3">
        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {prompt}
        </pre>
      </div>
    </div>
  )
}

function ToolsBlock({ tools }: { tools: string[] }) {
  const { t } = useTranslation()
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Wrench className="h-3 w-3" />{" "}
        {t("agent.toolsLabel", { count: tools.length })}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <Badge
            key={tool}
            variant="secondary"
            className="rounded-md px-2 py-0.5 text-[10px]"
            title={tool}
          >
            {toolDisplayName(tool, t)}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function PermissionsSection({
  permissions,
}: {
  permissions: NonNullable<AgentDetail["permissions"]>
}) {
  const { t } = useTranslation()
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Shield className="h-3 w-3" /> {t("agent.permPolicyTitle")}
      </h4>
      <div className="flex flex-col gap-2">
        <PermBadgeRow
          label={t("agent.autoApprove")}
          tools={permissions.auto_approve}
          className="rounded-md bg-success/10 px-1.5 py-0 text-[10px] text-success"
        />
        <PermBadgeRow
          label={t("agent.alwaysDeny")}
          tools={permissions.always_deny}
          className="rounded-md bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive"
        />
      </div>
    </div>
  )
}

function PermBadgeRow({
  label,
  tools,
  className,
}: {
  label: string
  tools?: string[]
  className: string
}) {
  if (!tools || tools.length === 0) return null
  return (
    <div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {tools.map((tool) => (
          <Badge key={tool} variant="secondary" className={className}>
            {tool}
          </Badge>
        ))}
      </div>
    </div>
  )
}
